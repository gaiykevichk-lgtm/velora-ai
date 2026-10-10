import { NextResponse } from "next/server";
import { dbAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lightweight readiness probe: verifies the database is reachable and the
// schema exists, without ever echoing the connection string or credentials.
export async function GET() {
	const started = Date.now();
	try {
		const pool = await dbAsync();
		await pool.query("SELECT 1");
		const table = await pool.query<{ users: string | null }>(
			"SELECT to_regclass('public.users') AS users",
		);
		return NextResponse.json({
			db: true,
			usersTable: table.rows[0]?.users ?? null,
			ms: Date.now() - started,
		});
	} catch (error) {
		const err = error as { code?: string; message?: string };
		const reason = (err?.message ?? "unknown")
			.slice(0, 160)
			.replace(/(postgres(ql)?:\/\/)[^\s]+/gi, "$1[redacted]");
		return NextResponse.json(
			{ db: false, code: err?.code ?? null, reason, ms: Date.now() - started },
			{ status: 503 },
		);
	}
}
