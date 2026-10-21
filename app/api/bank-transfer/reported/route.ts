import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { audit, bankConfig } from "@/lib/bank-transfer";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
	try {
		bankConfig();
		const account = await user();
		if (!account) return unauthorized();
		const parsed = z.object({ orderId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
		if (!parsed.success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
		const pool = await dbAsync();
		const order = (await pool.query("SELECT status FROM bank_orders WHERE id=$1 AND user_id=$2", [parsed.data.orderId, account.id])).rows[0];
		if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
		if (!["awaiting_payment", "confirmed", "partial", "review"].includes(order.status))
			return NextResponse.json({ error: `Order is ${order.status}.` }, { status: 409 });
		await pool.query("UPDATE bank_orders SET status='reported',updated_at=now() WHERE id=$1 AND status<> 'credited'", [parsed.data.orderId]);
		await audit(pool, parsed.data.orderId, account.email, "order.reported", {});
		return NextResponse.json({ reported: true });
	} catch (e) { return failure(e); }
}
