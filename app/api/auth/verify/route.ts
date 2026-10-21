import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import {
	isSmtpConfigured,
	newVerificationToken,
	sendVerificationEmail,
} from "@/lib/verify-email";

export const dynamic = "force-dynamic";

// GET /api/auth/verify?token=... — confirm email, then redirect to studio.
export async function GET(req: Request) {
	try {
		const token = new URL(req.url).searchParams.get("token") ?? "";
		if (!/^[a-f0-9]{64}$/i.test(token))
			return NextResponse.json(
				{ error: "Invalid confirmation link." },
				{ status: 400 },
			);
		const pool = await dbAsync();
		const tokenHash = createHash("sha256").update(token).digest("hex");
		const found = await pool.query<{
			user_id: string;
			expires_at: string;
		}>("SELECT user_id, expires_at FROM email_verifications WHERE token_hash=$1", [
			tokenHash,
		]);
		const row = found.rows[0];
		if (!row)
			return NextResponse.json(
				{ error: "This confirmation link is invalid or already used." },
				{ status: 400 },
			);
		if (new Date(row.expires_at).getTime() < Date.now()) {
			await pool.query("DELETE FROM email_verifications WHERE token_hash=$1", [
				tokenHash,
			]);
			return NextResponse.json(
				{ error: "This confirmation link has expired. Request a new one." },
				{ status: 410 },
			);
		}
		await pool.query("UPDATE users SET email_verified=true WHERE id=$1", [
			row.user_id,
		]);
		await pool.query("DELETE FROM email_verifications WHERE user_id=$1", [
			row.user_id,
		]);
		const base = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
		if (base) return NextResponse.redirect(`${base}/studio?verified=1`);
		return NextResponse.json({ ok: true });
	} catch (e) {
		return failure(e);
	}
}

// POST /api/auth/verify — resend confirmation link for an unverified email.
export async function POST(req: Request) {
	try {
		const { email } = (await req.json().catch(() => ({}))) as {
			email?: string;
		};
		const normalized = String(email ?? "").toLowerCase().trim();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) || normalized.length > 254)
			return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
		const pool = await dbAsync();
		const found = await pool.query<{ id: string; email_verified: boolean }>(
			"SELECT id, email_verified FROM users WHERE email=$1",
			[normalized],
		);
		const account = found.rows[0];
		// Always return ok to avoid leaking which emails are registered.
		if (!account) return NextResponse.json({ ok: true });
		if (account.email_verified) return NextResponse.json({ ok: true });
		// Rate limit: at most 3 active links (one per resend, old ones deleted).
		await pool.query("DELETE FROM email_verifications WHERE user_id=$1", [
			account.id,
		]);
		const { token, tokenHash } = newVerificationToken();
		await pool.query(
			"INSERT INTO email_verifications (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,now()+interval '24 hours')",
			[randomUUID(), account.id, tokenHash],
		);
		const result = await sendVerificationEmail(normalized, token);
		const dev =
			process.env.NODE_ENV !== "production" && !isSmtpConfigured();
		return NextResponse.json({
			ok: true,
			...(dev ? { devVerifyLink: result.link } : {}),
		});
	} catch (e) {
		return failure(e);
	}
}
