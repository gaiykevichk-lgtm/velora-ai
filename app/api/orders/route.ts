import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { user } from "@/lib/auth";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { TOKENS_PER_EUR } from "@/lib/company";

const createSchema = z.object({
	eurAmount: z.number().int().min(1).max(10000),
});

const decideSchema = z.object({
	id: z.string().uuid(),
	action: z.enum(["invoiced", "credited", "cancelled"]),
	adminNote: z.string().max(2000).default(""),
});

// Current user: list own orders. Admin: list recent orders across users.
export async function GET() {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const pool = await dbAsync();
		const admin = await adminUser();
		if (admin) {
			const { rows } = await pool.query(
				"SELECT id,user_id,email,eur_amount,tokens,status,admin_note,created_at,decided_at FROM token_orders ORDER BY created_at DESC LIMIT 100",
			);
			return NextResponse.json({ orders: rows, isAdmin: true });
		}
		const { rows } = await pool.query(
			"SELECT id,eur_amount,tokens,status,admin_note,created_at,decided_at FROM token_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
			[account.id],
		);
		return NextResponse.json({ orders: rows, isAdmin: false });
	} catch (e) {
		return failure(e);
	}
}

// Current user: place an invoice order. Nothing is charged or credited here.
// An administrator issues the invoice and credits tokens after payment.
export async function POST(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const body = createSchema.safeParse(await req.json());
		if (!body.success)
			return NextResponse.json(
				{ error: "Choose an amount between €1 and €10,000." },
				{ status: 400 },
			);
		const tokens = body.data.eurAmount * TOKENS_PER_EUR;
		const pool = await dbAsync();
		const id = randomUUID();
		const { rows } = await pool.query(
			"INSERT INTO token_orders (id,user_id,email,eur_amount,tokens,status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id,eur_amount,tokens,status,created_at",
			[id, account.id, account.email, body.data.eurAmount, tokens],
		);
		return NextResponse.json({ order: rows[0] }, { status: 201 });
	} catch (e) {
		return failure(e);
	}
}

// Admin only: mark invoiced / credit tokens / cancel. Credit is idempotent per order.
export async function PATCH(req: NextRequest) {
	try {
		const admin = await adminUser();
		if (!admin)
			return NextResponse.json(
				{ error: "Administrator access required." },
				{ status: 403 },
			);
		const body = decideSchema.safeParse(await req.json());
		if (!body.success)
			return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
		const pool = await dbAsync();
		const current = await pool.query(
			"SELECT id,user_id,tokens,status FROM token_orders WHERE id=$1",
			[body.data.id],
		);
		if (!current.rows[0])
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		const order = current.rows[0] as {
			user_id: string;
			tokens: number;
			status: string;
		};
		if (body.data.action === "credited") {
			if (order.status === "credited")
				return NextResponse.json(
					{ error: "This order has already been credited." },
					{ status: 409 },
				);
			const creditedId = randomUUID();
			const txId = randomUUID();
			await pool.query("BEGIN");
			try {
				await pool.query("UPDATE users SET tokens=tokens+$1 WHERE id=$2", [
					order.tokens,
					order.user_id,
				]);
				await pool.query(
					"INSERT INTO token_transactions (id,user_id,amount,reason) VALUES ($1,$2,$3,$4)",
					[
						txId,
						order.user_id,
						order.tokens,
						`Invoice order credited by administrator (${body.data.id})`,
					],
				);
				const { rows } = await pool.query(
					"UPDATE token_orders SET status='credited',admin_note=$2,decided_at=now() WHERE id=$1 RETURNING id,eur_amount,tokens,status,admin_note,decided_at",
					[body.data.id, body.data.adminNote],
				);
				await pool.query("COMMIT");
				return NextResponse.json({ order: rows[0], creditTxId: creditedId });
			} catch (e) {
				await pool.query("ROLLBACK");
				throw e;
			}
		}
		const { rows } = await pool.query(
			"UPDATE token_orders SET status=$2,admin_note=$3,decided_at=now() WHERE id=$1 RETURNING id,eur_amount,tokens,status,admin_note,decided_at",
			[body.data.id, body.data.action, body.data.adminNote],
		);
		return NextResponse.json({ order: rows[0] });
	} catch (e) {
		return failure(e);
	}
}
