import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { invoicePdf } from "@/lib/invoice-pdf.mjs";
import { cardInvoice } from "@/lib/invoice-order";


export const dynamic = "force-dynamic";
// Invoice/receipt for a paid card order; available to its owner only.
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return NextResponse.redirect(new URL(`/studio?auth=login&returnTo=${encodeURIComponent(req.nextUrl.pathname+req.nextUrl.search)}`,req.url));
		const id = req.nextUrl.searchParams.get("orderId");
		if (!z.string().uuid().safeParse(id).success)
			return NextResponse.json({ error: "Invalid order." }, { status: 400 });
		const { rows } = await (await dbAsync()).query(
			"SELECT id,eur_amount,tokens,status,paid_at,created_at,email,provider_order_id FROM payment_orders WHERE id=$1 AND user_id=$2",
			[id, account.id],
		);
		const o = rows[0];
		if (!o)
			return NextResponse.json({ error: "Order not found." }, { status: 404 });
		if (o.status !== "credited")
			return NextResponse.json(
				{ error: "The invoice is available once the payment is confirmed." },
				{ status: 409 },
			);
        const order = await cardInvoice(o.id);
        const date = new Date(order.paid_at);
        const number = order.invoice_number;
        const pdf = await invoicePdf({ number, date:date.toISOString().slice(0,10), email:order.email, buyerName:order.buyer_name, method:'Card', reference:order.provider_order_id, amount:Number(order.eur_amount), tokens:Number(order.tokens), paid:true, totalPaid:Number(order.eur_amount) });

		return new NextResponse(new Uint8Array(pdf), {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="invoice-${number}.pdf"`,
			},
		});
	} catch (e) {
		return failure(e);
	}
}
