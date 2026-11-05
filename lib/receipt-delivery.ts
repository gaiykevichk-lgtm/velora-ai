import { cardInvoice } from "./invoice-order";
import { dbAsync } from "./db";
import { purchaseReceipt } from "./purchase-receipt.mjs";
import { sendHtmlMail } from "./verify-email";

type Method = "card" | "bank";

// Claim one queued receipt atomically. Expired claims require human review rather
// than automatic re-sending: the provider could have accepted a timed-out request.
export async function deliverPurchaseReceipt(method: Method, orderId: string) {
	const pool = await dbAsync();
	const claimed = await pool.query(
		"UPDATE purchase_receipt_outbox SET state='sending',attempts=attempts+1,updated_at=now() WHERE method=$1 AND order_id=$2 AND state='pending' RETURNING attempts",
		[method, orderId],
	);
	if (!claimed.rowCount) return { sent: false, reason: "not-pending" };
	try {
		const result =
			method === "card"
				? await pool.query(
						"SELECT id,email,eur_amount,tokens,status,paid_at AS credit_date FROM payment_orders WHERE id=$1",
						[orderId],
					)
				: await pool.query(
						"SELECT o.id,o.email,o.eur_amount,o.tokens,o.status,o.confirmed_at AS credit_date,d.id AS invoice_id,d.doc_number AS invoice_number,o.buyer FROM bank_orders o JOIN bank_order_documents d ON d.order_id=o.id AND d.kind='invoice' WHERE o.id=$1 ORDER BY d.created_at LIMIT 1",
						[orderId],
					);
		const order = method === "card" ? await cardInvoice(orderId) : result.rows[0];
        if (method === "card" && order) order.credit_date = order.paid_at;
		if (!order || order.status !== "credited" || !order.credit_date)
			throw new Error("Credited order or invoice is missing.");
		const date = new Date(order.credit_date);
		const origin = new URL(process.env.APP_BASE_URL || "");
		if (
			origin.protocol !== "https:" ||
			origin.username ||
			origin.password ||
			origin.pathname !== "/" ||
			origin.search ||
			origin.hash
		)
			throw new Error("APP_BASE_URL must be an HTTPS origin.");
		const invoiceNumber =
			method === "card"
				? order.invoice_number
				: order.invoice_number;
		const invoicePath =
			method === "card"
				? `/api/payments/invoice?orderId=${encodeURIComponent(order.id)}`
				: `/api/bank-transfer/documents?kind=document&doc=${encodeURIComponent(order.invoice_id)}`;
		const content = purchaseReceipt({
			status: order.status,
			email: order.email,
            buyerName: order.buyer_name || order.buyer?.legalName || order.buyer?.fullName,
			invoiceNumber,
			invoiceUrl: new URL(invoicePath, origin).href,
			date: date.toISOString().slice(0, 10),
			method: method === "card" ? "Card" : "Bank transfer",
			tokens: Number(order.tokens),
			amount: Number(order.eur_amount),
		});
		const stored = await pool.query("UPDATE purchase_receipt_outbox SET payload=COALESCE(payload,$3::jsonb),first_attempt_at=COALESCE(first_attempt_at,now()) WHERE method=$1 AND order_id=$2 RETURNING payload", [method,orderId,JSON.stringify({to:order.email,...content})]);
        const message = stored.rows[0].payload;
        const sent = await sendHtmlMail(
			message.to,
            message.subject,
            message.text,
            message.html,
			`receipt/${method}/${orderId}`,
		);
		if (!sent.sent) throw new Error("Mail transport is not configured.");
		await pool.query(
			"UPDATE purchase_receipt_outbox SET state='sent',message_id=$3,sent_at=now(),updated_at=now(),last_error=NULL WHERE method=$1 AND order_id=$2",
			[method, orderId, sent.messageId],
		);
		return { sent: true };
	} catch (error) {
		// An ambiguous provider response must be reviewed before retry; otherwise the
		// first request could have been delivered even when the connection timed out.
		await pool.query(
			"UPDATE purchase_receipt_outbox SET state='failed',last_error=$3,updated_at=now() WHERE method=$1 AND order_id=$2",
			[method, orderId, String((error as Error).message).slice(0, 300)],
		);
		throw error;
	}
}
