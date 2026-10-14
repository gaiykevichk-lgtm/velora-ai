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
		}>("SELECT id,password_hash FROM users WHERE email=$1", [email]);
		let id: string;
		if (req.nextUrl.searchParams.get("action") === "register") {
			if (found.rowCount)
				return NextResponse.json(
					{ error: "This email is already registered." },
					{ status: 409 },
				);
			id = randomUUID();
			try {
				await (await dbAsync()).query(
					"INSERT INTO users (id,email,password_hash,tokens) VALUES ($1,$2,$3,0)",
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
		} else {
			if (
				!found.rows[0] ||
				!verifyPassword(password, found.rows[0].password_hash)
			)
				return NextResponse.json(
					{ error: "Invalid email or password." },
					{ status: 401 },
				);
			id = found.rows[0].id;
		}
		await createSession(id);
		const updated = await (await dbAsync()).query<{
			id: string;
			email: string;
			tokens: number;
		}>("SELECT id,email,tokens FROM users WHERE id=$1", [id]);
		return NextResponse.json({ user: updated.rows[0] });
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
