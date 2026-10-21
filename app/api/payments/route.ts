import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { paymentConfig, paymentsEnabled, settlePayment } from "@/lib/payments";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const pool = await dbAsync();
		const id = req.nextUrl.searchParams.get("orderId");
		if (id) {
			if (!z.string().uuid().safeParse(id).success)
				return NextResponse.json(
					{ error: "Invalid order ID." },
					{ status: 400 },
				);
			const own = await pool.query(
				"SELECT id,provider_order_id,status FROM payment_orders WHERE id=$1 AND user_id=$2",
				[id, account.id],
			);
			if (!own.rowCount)
				return NextResponse.json(
					{ error: "Order not found." },
					{ status: 404 },
				);
			if (own.rows[0].provider_order_id && own.rows[0].status !== "credited")
				await settlePayment(id, paymentConfig());
		}
		const { rows } = await pool.query(
			"SELECT id,eur_amount,tokens,status,created_at,paid_at,expires_at FROM payment_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
			[account.id],
		);
		return NextResponse.json(
			{ enabled: paymentsEnabled(), orders: rows },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		return failure(error);
	}
}
