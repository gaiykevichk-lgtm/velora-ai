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
		const check = await (await dbAsync()).query(
			"SELECT 1 FROM workspaces WHERE id=$1 AND user_id=$2",
			[id, account.id],
		);
		if (!check.rowCount)
			return NextResponse.json(
				{ error: "Workspace not found." },
				{ status: 404 },
			);
		const { rows } = await (await dbAsync()).query(
			"SELECT id,mode,prompt,result,status,error,created_at FROM runs WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at ASC LIMIT 100",
			[id, account.id],
		);
		return NextResponse.json({ runs: rows });
	} catch (e) {
		return failure(e);
	}
}
export async function POST(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success)
			return NextResponse.json(
				{ error: "Check your prompt and settings." },
				{ status: 400 },
			);
		const { workspaceId, mode, prompt, aspectRatio, duration, reference } =
			parsed.data;
		const ref = parseReference(reference);
		const workspace = await (await dbAsync()).query<{ mode: string }>(
			"SELECT mode FROM workspaces WHERE id=$1 AND user_id=$2",
			[workspaceId, account.id],
		);
		if (!workspace.rowCount || workspace.rows[0].mode !== mode)
			return NextResponse.json(
				{ error: "Workspace not found for this mode." },
				{ status: 404 },
			);
		const recent = await (await dbAsync()).query(
			"SELECT count(*)::int AS count FROM runs WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
			[account.id],
		);
		if (recent.rows[0].count >= 20)
			return NextResponse.json(
				{ error: "Hourly generation limit reached. Please try again later." },
				{ status: 429 },
			);

		const TOKEN_RATES: Record<string, number> = {
			text: 5,
			image: 25,
			video: 100,
		};
		const tokenCost = TOKEN_RATES[mode] || 10;
		const pool = await dbAsync();

		const balanceCheck = await pool.query<{ tokens: number }>(
			"SELECT tokens FROM users WHERE id=$1",
			[account.id],
		);
		const currentTokens = balanceCheck.rows[0]?.tokens ?? 0;
		if (currentTokens < tokenCost) {
			return NextResponse.json(
				{
					error: `Insufficient tokens (${currentTokens} available, ${tokenCost} required for ${mode}). Please top up your balance.`,
					code: "INSUFFICIENT_TOKENS",
					required: tokenCost,
					available: currentTokens,
				},
				{ status: 402 },
			);
		}

		const id = randomUUID();
		let result: string | null = null;
		let jobId: string | null = null;
		let status = "completed";
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
				result = await generateText([
					...history,
					{ role: "user", content: prompt },
				]);
			} else if (mode === "image") result = await generateImage(prompt, ref);
			else {
				const video = await submitVideo(
					prompt,
					aspectRatio,
					duration,
					reference,
				);
				jobId = video.id;
				result = video.outputUrl;
				status = video.status;
			}
		} catch (e) {
			if (e instanceof ConfigurationError) return failure(e);
			throw e;
		}

		const newBalance = Math.max(0, currentTokens - tokenCost);
		await pool.query("UPDATE users SET tokens = $1 WHERE id = $2", [
			newBalance,
			account.id,
		]);
		const txId = randomUUID();
		await pool.query(
			"INSERT INTO token_transactions (id, user_id, amount, reason) VALUES ($1, $2, $3, $4)",
			[
				txId,
				account.id,
				-tokenCost,
				`Generation: ${mode} (-${tokenCost} tokens)`,
			],
		);

		await pool.query(
			"INSERT INTO runs (id,workspace_id,user_id,mode,prompt,result,provider_job_id,tokens_spent,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
			[
				id,
				workspaceId,
				account.id,
				mode,
				prompt,
				result,
				jobId,
				tokenCost,
				status,
			],
		);

		const updatedTokensRes = await pool.query<{ tokens: number }>(
			"SELECT tokens FROM users WHERE id=$1",
			[account.id],
		);

		return NextResponse.json(
			{
				run: {
					id,
					mode,
					prompt,
					result,
					status,
					error: null,
					tokensSpent: tokenCost,
				},
				tokens: updatedTokensRes.rows[0]?.tokens ?? 0,
			},
			{ status: 201 },
		);
	} catch (e) {
		if (e instanceof Error && e.message.startsWith("Reference image"))
			return NextResponse.json({ error: e.message }, { status: 400 });
		return failure(e);
	}
}
