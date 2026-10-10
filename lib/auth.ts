import {
	createHash,
	randomBytes,
	scryptSync,
	timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { dbAsync } from "./db";
const cookieName = "velora_session";
export function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
export function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash || hash.length !== 128) return false;
	return timingSafeEqual(
		scryptSync(password, salt, 64),
		Buffer.from(hash, "hex"),
	);
}
export async function user() {
	const token = (await cookies()).get(cookieName)?.value;
	if (!token) return null;
	const { rows } = await (await dbAsync()).query<{
		id: string;
		email: string;
		tokens: number;
	}>(
		`SELECT u.id,u.email,u.tokens FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=$1 AND s.expires_at>now()`,
		[hashToken(token)],
	);
	return rows[0] ?? null;
}
export async function createSession(userId: string) {
	const token = randomBytes(32).toString("hex");
	await (await dbAsync()).query(
		`INSERT INTO sessions (id_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '30 days')`,
		[hashToken(token), userId],
	);
	(await cookies()).set(cookieName, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 30 * 86400,
	});
}
export async function endSession() {
	const store = await cookies();
	const token = store.get(cookieName)?.value;
	if (token && process.env.DATABASE_URL)
		await (await dbAsync()).query("DELETE FROM sessions WHERE id_hash=$1", [
			hashToken(token),
		]);
	store.delete(cookieName);
}
