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
	acceptTerms: z.boolean().optional(),
	marketing: z.boolean().optional(),
});
const TERMS_VERSION = process.env.TERMS_VERSION?.trim() || "2026-10-29-v1";
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
		const { email, password, acceptTerms, marketing } = body.data;
		const found = await (await dbAsync()).query<{
			id: string;
			password_hash: string;
			email_verified: boolean;
		}>("SELECT id,password_hash,email_verified FROM users WHERE email=$1", [email]);
		let id: string;
		let needsVerification = false;
		let emailSent = false;
		let devVerifyLink: string | null = null;
		if (req.nextUrl.searchParams.get("action") === "register") {
			if (acceptTerms !== true)
				return NextResponse.json(
					{ error: "Please accept the Terms and the Privacy Policy to create an account." },
					{ status: 400 },
				);
			if (found.rowCount)
				return NextResponse.json(
					{ error: "This email is already registered." },
					{ status: 409 },
				);
			id = randomUUID();
			try {
				await (await dbAsync()).query(
					"INSERT INTO users (id,email,password_hash,tokens,email_verified,terms_version,terms_accepted_at,marketing_opt_in) VALUES ($1,$2,$3,0,false,$4,now(),$5)",
					[id, email, hashPassword(password), TERMS_VERSION, marketing === true],
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
				emailSent = result.sent;
				if (!result.sent && process.env.NODE_ENV !== "production")
					devVerifyLink = result.link;
			} catch {
				// Account is created; the link can be re-requested via resend.
				needsVerification = true;
				emailSent = false;
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
						emailSent,
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
