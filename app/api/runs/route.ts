import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import {
	ConfigurationError,
	generateImage,
	generateText,
	submitVideo,
} from "@/lib/provider";
import {
	captureReservation,
	releaseReservation,
	reservedTokens,
	reserveTokens,
	syncTokenBalance,
} from "@/lib/tokens";
import { failRun, sweepVideos } from "@/lib/video-jobs";
import { fetchImageBytes, matchesAspect } from "@/lib/provider";
const schema = z.object({
	workspaceId: z.string().uuid(),
	mode: z.enum(["text", "image", "video"]),
	prompt: z.string().trim().min(1).max(8000),
	aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
	duration: z.union([z.literal(6), z.literal(10)]).default(6),
	reference: z.string().max(8_000_000).optional(),
});
function parseReference(value?: string) {
	if (!value) return undefined;
	const match =
		/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
	if (!match || Buffer.from(match[2], "base64").length > 5_000_000)
		throw new Error("Reference image must be PNG, JPEG or WebP under 5 MB.");
	return { mime: match[1], base64: match[2] };
}
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const id = req.nextUrl.searchParams.get("workspaceId");
		if (!id || !z.string().uuid().safeParse(id).success)
			return NextResponse.json(
				{ error: "Invalid workspace." },
				{ status: 400 },
			);
		const pool = await dbAsync();
		const check = await pool.query(
			"SELECT 1 FROM workspaces WHERE id=$1 AND user_id=$2",
			[id, account.id],
		);
		if (!check.rowCount)
			return NextResponse.json(
				{ error: "Workspace not found." },
				{ status: 404 },
			);
		// Server keeps tracking jobs on its own; this just nudges an immediate check.
		void sweepVideos(account.id).catch(() => {});
		const { rows } = await pool.query(
			"SELECT id,mode,prompt,result,status,error,tokens_spent,aspect_ratio,duration,created_at FROM runs WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at ASC LIMIT 100",
			[id, account.id],
		);
		const balance = await syncTokenBalance(pool, account.id);
		return NextResponse.json({
			runs: rows,
			tokens: balance.tokens,
			reserved: await reservedTokens(pool, account.id),
		});
	} catch (e) {
		return failure(e);
	}
}
export async function POST(req: NextRequest) {
	let runId: string | null = null;
	try {
		const account = await user();
		if (!account) return unauthorized();
		if (!account.email_verified)
			return NextResponse.json(
				{
					error:
						"Please confirm your email first. Check your inbox for the confirmation link.",
					code: "EMAIL_NOT_VERIFIED",
				},
				{ status: 403 },
			);
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success)
			return NextResponse.json(
				{ error: "Check your prompt and settings." },
				{ status: 400 },
			);
		const { workspaceId, mode, prompt, aspectRatio, duration, reference } =
			parsed.data;
		const ref = parseReference(reference);
		const pool = await dbAsync();
		const workspace = await pool.query<{ mode: string }>(
			"SELECT mode FROM workspaces WHERE id=$1 AND user_id=$2",
			[workspaceId, account.id],
		);
		if (!workspace.rowCount || workspace.rows[0].mode !== mode)
			return NextResponse.json(
				{ error: "Workspace not found for this mode." },
				{ status: 404 },
			);
		const recent = await pool.query(
			"SELECT count(*)::int AS count FROM runs WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
			[account.id],
		);
		if (recent.rows[0].count >= 20)
			return NextResponse.json(
				{ error: "Hourly generation limit reached. Please try again later." },
				{ status: 429 },
			);

		const TOKEN_RATES: Record<string, number> = { text: 5, image: 25, video: 100 };
		const tokenCost = TOKEN_RATES[mode] || 10;

		const id = randomUUID();
		runId = id;
		const insufficient = (available: number) =>
			NextResponse.json(
				{
					error: `Insufficient tokens (${available} available, ${tokenCost} required for ${mode}). Please top up your balance.`,
					code: "INSUFFICIENT_TOKENS",
					required: tokenCost,
					available,
				},
				{ status: 402 },
			);
		// The run row exists first so the reservation always has an owner.
		await pool.query(
			"INSERT INTO runs (id,workspace_id,user_id,mode,prompt,tokens_spent,status,aspect_ratio,duration) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8)",
			[id, workspaceId, account.id, mode, prompt, tokenCost, mode === "text" ? null : aspectRatio, mode === "video" ? duration : null],
		);
		const reserve = await reserveTokens(pool, account.id, id, tokenCost);
		if (!reserve.ok) {
			await pool.query("DELETE FROM runs WHERE id=$1", [id]);
			return insufficient(reserve.tokens);
		}

		let result: string | null = null;
		let status: string = "completed";
		try {
			if (mode === "text") {
				const previous = await pool.query<{ prompt: string; result: string }>(
					"SELECT prompt,result FROM runs WHERE workspace_id=$1 AND user_id=$2 AND mode='text' AND status='completed' ORDER BY created_at DESC LIMIT 8",
					[workspaceId, account.id],
				);
				const history = (previous.rows as { prompt: string; result: string }[])
					.reverse()
					.flatMap((r) => [
						{ role: "user" as const, content: r.prompt },
						{ role: "assistant" as const, content: r.result },
					]);
				result = await generateText([...history, { role: "user", content: prompt }]);
			} else if (mode === "image") {
				const out = await generateImage(prompt, aspectRatio, ref);
				const file = await fetchImageBytes(out);
				if (!file) throw new Error("image could not be stored");
				if (!matchesAspect(file.data, aspectRatio))
					throw new Error(`provider ignored requested format ${aspectRatio}`);
				await pool.query(
					"INSERT INTO run_media (run_id,user_id,mime,data) VALUES ($1,$2,$3,$4)",
					[id, account.id, file.mime, file.data],
				);
				result = `/api/media?runId=${id}`;
			} else {
				const video = await submitVideo(prompt, aspectRatio, duration, reference);
				await pool.query(
					"UPDATE runs SET provider_job_id=$2, status='queued', updated_at=now() WHERE id=$1",
					[id, video.id],
				);
				status = "queued";
			}
		} catch (e) {
			console.error("[run] generation failed", { runId: id, mode, error: (e as Error).message });
			await releaseReservation(pool, id);
			await pool.query(
				"UPDATE runs SET status='failed', error=$2, updated_at=now() WHERE id=$1",
				[id, "The generation failed. Your tokens were returned."],
			);
			if (e instanceof ConfigurationError) return failure(e);
			return NextResponse.json(
				{
					...(process.env.VELORA_DEBUG_ERRORS === "1" ? { debug: (e as Error).message.slice(0, 300) } : {}),
					error:
						mode === "image" && /requested format/.test((e as Error).message)
							? "The image provider could not produce the selected format. Your tokens were returned."
							: "The generation failed. Your tokens were returned. Please try again.",
				},
				{ status: 502 },
			);
		}

		if (mode !== "video") {
			await pool.query(
				"UPDATE runs SET status='completed', result=$2, updated_at=now() WHERE id=$1",
				[id, result],
			);
			await captureReservation(pool, id, `Generation: ${mode}`);
		}
		const balance = await syncTokenBalance(pool, account.id);
		return NextResponse.json(
			{
				run: { id, mode, prompt, result, status, error: null, tokens_spent: tokenCost, aspect_ratio: mode === "text" ? null : aspectRatio, duration: mode === "video" ? duration : null },
				tokens: balance.tokens,
				reserved: await reservedTokens(pool, account.id),
			},
			{ status: 201 },
		);
	} catch (e) {
		if (runId) {
			try {
				const pool = await dbAsync();
				const row = await pool.query("SELECT status,provider_job_id FROM runs WHERE id=$1", [runId]);
				if (row.rows[0] && !row.rows[0].provider_job_id && row.rows[0].status !== "completed")
					await failRun(runId, "The generation failed. Your tokens were returned.", (e as Error).message);
			} catch {}
		}
		if (e instanceof Error && e.message.startsWith("Reference image"))
			return NextResponse.json({ error: e.message }, { status: 400 });
		return failure(e);
	}
}
