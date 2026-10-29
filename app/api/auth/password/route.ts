import { type NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import { sendPlainMail, mailConfigured } from "@/lib/verify-email";

export const dynamic = "force-dynamic";
const RESET_MINUTES = 60;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

// POST: request a reset link. The answer never reveals whether the email exists.
export async function POST(req: NextRequest) {
	try {
		const parsed = z
			.object({ email: z.string().email().max(254) })
			.safeParse(await req.json().catch(() => null));
		if (!parsed.success)
			return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
		const email = parsed.data.email.toLowerCase().trim();
		const pool = await dbAsync();
		const found = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
		const account = found.rows[0];
		const generic = NextResponse.json({ ok: true });
		if (!account) return generic;
		const recent = await pool.query(
			"SELECT count(*)::int AS count FROM password_resets WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
			[account.id],
		);
		if (recent.rows[0].count >= 3) return generic;
		await pool.query("UPDATE password_resets SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [account.id]);
		const token = randomBytes(32).toString("hex");
		await pool.query(
			"INSERT INTO password_resets (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+($4 || ' minutes')::interval)",
			[randomUUID(), account.id, sha(token), String(RESET_MINUTES)],
		);
		const base = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "") || "http://localhost:3000";
		const link = `${base}/reset-password?token=${token}`;
		if (!mailConfigured()) {
			console.error("[password-reset] mail transport not configured; reset mail not sent");
			return generic;
		}
		try {
			await sendPlainMail(
				email,
				"Reset your Velora password",
				`We received a request to reset your Velora password.\n\nSet a new password (the link works once and expires in ${RESET_MINUTES} minutes):\n${link}\n\nIf you did not ask for this, ignore this message: your password stays unchanged.`,
			);
		} catch (e) {
			console.error("[password-reset] mail failed:", (e as Error).message);
		}
		return generic;
	} catch (e) {
		return failure(e);
	}
}

// PUT: set a new password with a one-time token.
export async function PUT(req: NextRequest) {
	try {
		const parsed = z
			.object({ token: z.string().regex(/^[a-f0-9]{64}$/i), password: z.string().min(10).max(128) })
			.safeParse(await req.json().catch(() => null));
		if (!parsed.success)
			return NextResponse.json(
				{ error: "Enter a password of at least 10 characters." },
				{ status: 400 },
			);
		const pool = await dbAsync();
		const hash = sha(parsed.data.token.toLowerCase());
		// Claim the token first so a reused link can never succeed twice.
		const claimed = await pool.query(
			"UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id",
			[hash],
		);
		if (!claimed.rowCount)
			return NextResponse.json(
				{ error: "This link is invalid, already used or expired. Request a new one." },
				{ status: 400 },
			);
		const userId = claimed.rows[0].user_id;
		await pool.query("UPDATE users SET password_hash=$2, email_verified=true WHERE id=$1", [userId, hashPassword(parsed.data.password)]);
		await pool.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
		return NextResponse.json({ ok: true });
	} catch (e) {
		return failure(e);
	}
}
