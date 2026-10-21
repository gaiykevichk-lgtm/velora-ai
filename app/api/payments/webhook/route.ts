import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import { paymentConfig, settlePayment } from "@/lib/payments";
import { verifyWebhook } from "@/lib/infini.mjs";
export const runtime = "nodejs";
const schema = z.object({
	event: z.string().max(100),
	order_id: z.string().min(1).max(200),
	client_reference: z.string().uuid(),
});
export async function POST(req: NextRequest) {
	try {
		const config = paymentConfig();
		if (Number(req.headers.get("content-length") || 0) > 131072)
			return new NextResponse(null, { status: 413 });
		// Bound even chunked payloads before buffering.
		const reader = req.body?.getReader();
		if (!reader) return new NextResponse(null, { status: 400 });
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > 131072) {
				await reader.cancel();
				return new NextResponse(null, { status: 413 });
			}
			chunks.push(value);
		}
		const raw = Buffer.concat(chunks);
		if (!verifyWebhook(raw, req.headers, config.webhookSecret))
			return NextResponse.json(
				{ error: "Invalid webhook signature." },
				{ status: 401 },
			);
		let json: unknown;
		try {
			json = JSON.parse(raw.toString("utf8"));
		} catch {
			return new NextResponse(null, { status: 400 });
		}
		// Unrelated subscriptions/cards are not payment orders.
		if (
			json &&
			typeof json === "object" &&
			"event" in json &&
			typeof json.event === "string" &&
			!json.event.startsWith("order.") &&
			!json.event.startsWith("auto_refund.")
		)
			return NextResponse.json({ received: true });
		const parsed = schema.safeParse(json);
		if (!parsed.success) return new NextResponse(null, { status: 400 });
		const event = parsed.data;
		const pool = await dbAsync();
		const { rows } = await pool.query(
			"SELECT id,provider_order_id FROM payment_orders WHERE id=$1",
			[event.client_reference],
		);
		// Unknown orders may belong to another application sharing the merchant.
		if (!rows[0]) return NextResponse.json({ received: true });
		if (!rows[0].provider_order_id)
			return NextResponse.json(
				{ error: "Order creation is still in progress. Retry delivery." },
				{ status: 503 },
			);
		if (rows[0].provider_order_id !== event.order_id)
			return NextResponse.json(
				{ error: "Order reference mismatch." },
				{ status: 400 },
			);
		const id = req.headers.get("x-webhook-event-id")!;
		const hash = createHash("sha256").update(raw).digest("hex");
		const seen = await pool.query(
			"SELECT payload_hash FROM payment_events WHERE event_id=$1",
			[id],
		);
		if (seen.rowCount)
			return seen.rows[0].payload_hash === hash
				? NextResponse.json({ received: true })
				: new NextResponse(null, { status: 409 });
		if (event.event.startsWith("auto_refund.")) {
			// Do not credit from a refund notification; preserve event for operator review.
			await pool.query(
				"INSERT INTO payment_events (event_id,order_id,kind,payload_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (event_id) DO NOTHING",
				[id, event.client_reference, event.event, hash],
			);
		} else {
			await settlePayment(event.client_reference, config, {
				id,
				kind: event.event,
				rawHash: hash,
			});
		}
		return NextResponse.json({ received: true });
	} catch (error) {
		return failure(error);
	}
}
