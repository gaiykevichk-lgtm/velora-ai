// Admin order list: bank transfers and card payments in one table.
// Server-side admin check; customers never receive other people's orders.
import { type NextRequest, NextResponse } from "next/server";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
	try {
		const admin = await adminUser();
		if (!admin)
			return NextResponse.json(
				{ error: "Administrator access required." },
				{ status: 403 },
			);
		const pool = await dbAsync();
		const bank = await pool.query(
			`SELECT o.id,o.public_number AS number,o.confirmed_at AS date,o.email,
				COALESCE(o.buyer->>'fullName',o.buyer->>'legalName','') AS customer,
				o.eur_amount AS ordered_eur,o.tokens AS ordered_tokens,
				COALESCE(o.credited_tokens,0) AS credited_tokens,o.status,
				COALESCE((SELECT SUM(amount_cents) FROM bank_payments p WHERE p.order_id=o.id),0)::int AS received_cents,
				(SELECT string_agg(DISTINCT sender_name,'; ') FROM bank_payments p WHERE p.order_id=o.id) AS payer
			FROM bank_orders o ORDER BY o.confirmed_at DESC LIMIT 300`,
		);
		const card = await pool.query(
			`SELECT o.id,o.invoice_number,o.created_at AS date,o.email,
				COALESCE(o.buyer_name,'') AS customer,
				o.eur_amount AS ordered_eur,o.tokens,o.status,o.paid_at
			FROM payment_orders o ORDER BY o.created_at DESC LIMIT 300`,
		);
		const orders = [
			...bank.rows.map((o: any) => ({
				kind: "bank" as const,
				id: o.id,
				number: o.number,
				date: o.date,
				customer: o.customer || o.email,
				email: o.email,
				method: "Bank Transfer",
				orderedEur: Number(o.ordered_eur),
				receivedEur: Number(o.received_cents) / 100,
				tokensOrdered: Number(o.ordered_tokens),
				tokensCredited: Number(o.credited_tokens),
				payer: o.payer || "",
				status: o.status,
			})),
			...card.rows.map((o: any) => ({
				kind: "card" as const,
				id: o.id,
				number: o.invoice_number ?? o.id.slice(0, 8),
				date: o.date,
				customer: o.customer || o.email,
				email: o.email,
				method: "Card",
				orderedEur: Number(o.ordered_eur),
				receivedEur: o.status === "credited" ? Number(o.ordered_eur) : 0,
				tokensOrdered: Number(o.tokens),
				tokensCredited: o.status === "credited" ? Number(o.tokens) : 0,
				payer: "",
				status: o.status,
			})),
		].sort((a, b) => +new Date(b.date) - +new Date(a.date));
		return NextResponse.json({ orders });
	} catch (e) {
		return failure(e);
	}
}
