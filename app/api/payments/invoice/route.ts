import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { textPdf } from "@/lib/bank-transfer";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";
// Invoice/receipt for a paid card order; available to its owner only.
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const id = req.nextUrl.searchParams.get("orderId");
		if (!z.string().uuid().safeParse(id).success)
			return NextResponse.json({ error: "Invalid order." }, { status: 400 });
		const { rows } = await (await dbAsync()).query(
			"SELECT id,eur_amount,tokens,status,paid_at,created_at,email,provider_order_id FROM payment_orders WHERE id=$1 AND user_id=$2",
			[id, account.id],
		);
		const o = rows[0];
		if (!o) return NextResponse.json({ error: "Order not found." }, { status: 404 });
		if (o.status !== "credited")
			return NextResponse.json({ error: "The invoice is available once the payment is confirmed." }, { status: 409 });
		const date = new Date(o.paid_at ?? o.created_at);
		const number = `ONL-${date.getUTCFullYear()}-${String(o.id).slice(0, 8).toUpperCase()}`;
		const pdf = textPdf(`Invoice ${number}`, [
			`INVOICE ${number}`,
			`Date: ${date.toISOString().slice(0, 10)}`,
			`Seller: ${COMPANY.name}, ${COMPANY.address}`,
			`Seller registration: ${COMPANY.registration}`,
			`Seller VAT ID: FR81107643348`,
			`Buyer email: ${o.email}`,
			`Item: Prepaid Velora AI tokens (usage units for AI generation)`,
			`Quantity: ${Number(o.tokens).toLocaleString("en-US")} tokens   Total: ${Number(o.eur_amount).toFixed(2)} EUR`,
			`Payment method: Card`,
			...(o.provider_order_id ? [`Provider order reference: ${o.provider_order_id}`] : []),
			`Status: Paid`,
			`Total paid: ${Number(o.eur_amount).toFixed(2)} EUR`,
			`${Number(o.tokens).toLocaleString("en-US")} tokens credited to your balance.`,
			`Tokens valid 12 months from the credit date.`,
		]);
		return new NextResponse(new Uint8Array(pdf), {
			headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="invoice-${number}.pdf"` },
		});
	} catch (e) {
		return failure(e);
	}
}
