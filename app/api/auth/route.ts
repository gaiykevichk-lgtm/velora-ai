import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
	createSession,
	endSession,
	hashPassword,
	user,
	verifyPassword,
} from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import {
	isSmtpConfigured,
	newVerificationToken,
	sendVerificationEmail,
} from "@/lib/verify-email";
const schema = z.object({
	email: z
		.string()
		.email()
		.max(254)
		.transform((v) => v.toLowerCase().trim()),
	password: z.string().min(10).max(128),
});
export async function GET() {
	try {
		return NextResponse.json({ user: await user() });
	} catch (e) {
		return failure(e);
	}
}
export async function POST(req: NextRequest) {
	try {
		const body = schema.safeParse(await req.json());
		if (!body.success)
			return NextResponse.json(
				{
					error:
						"Enter a valid email and a password of at least 10 characters.",
				},
				{ status: 400 },
			);
		const { email, password } = body.data;
		const found = await (await dbAsync()).query<{
			id: string;
			password_hash: string;
			email_verified: boolean;
		}>("SELECT id,password_hash,email_verified FROM users WHERE email=$1", [email]);
		let id: string;
		let needsVerification = false;
		let devVerifyLink: string | null = null;
		if (req.nextUrl.searchParams.get("action") === "register") {
			if (found.rowCount)
				return NextResponse.json(
					{ error: "This email is already registered." },
					{ status: 409 },
				);
			id = randomUUID();
			try {
				await (await dbAsync()).query(
					"INSERT INTO users (id,email,password_hash,tokens,email_verified) VALUES ($1,$2,$3,0,false)",
					[id, email, hashPassword(password)],
				);
			} catch (e) {
				if ((e as { code?: string }).code === "23505")
					return NextResponse.json(
						{ error: "This email is already registered." },
						{ status: 409 },
					);
				throw e;
			}
			needsVerification = true;
			const { token, tokenHash } = newVerificationToken();
			try {
				await (await dbAsync()).query(
					"INSERT INTO email_verifications (id, user_id, token_hash, expires_at) VALUES ($1,$2,$3,now()+interval '24 hours')",
					[randomUUID(), id, tokenHash],
				);
				const result = await sendVerificationEmail(email, token);
				if (!result.sent && process.env.NODE_ENV !== "production")
					devVerifyLink = result.link;
			} catch {
				// Account is created; the link can be re-requested via resend.
				needsVerification = true;
			}
		} else {
			if (
				!found.rows[0] ||
				!verifyPassword(password, found.rows[0].password_hash)
			)
				return NextResponse.json(
					{ error: "Invalid email or password." },
					{ status: 401 },
				);
			if (!found.rows[0].email_verified)
				return NextResponse.json(
					{
						error: "Please confirm your email first. Check your inbox for the confirmation link.",
						code: "EMAIL_NOT_VERIFIED",
					},
					{ status: 403 },
				);
			id = found.rows[0].id;
		}
		await createSession(id);
		const updated = await (await dbAsync()).query<{
			id: string;
			email: string;
			tokens: number;
			email_verified: boolean;
		}>("SELECT id,email,tokens,email_verified FROM users WHERE id=$1", [id]);
		return NextResponse.json({
			user: updated.rows[0],
			...(needsVerification
				? {
						needsVerification: true as const,
						emailSent: isSmtpConfigured(),
						...(devVerifyLink ? { devVerifyLink } : {}),
					}
				: {}),
		});
	} catch (e) {
		return failure(e);
	}
}
export async function DELETE() {
	try {
		await endSession();
		return NextResponse.json({ ok: true });
	} catch (e) {
		return failure(e);
	}
}
