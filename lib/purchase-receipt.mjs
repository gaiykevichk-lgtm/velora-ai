// Receipt copy shared by both payment methods. Only render after an order is credited.
const escapeHtml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);

export function purchaseReceipt(order) {
	if (order.status !== "credited")
		throw new Error("Receipt requires a credited order.");
	if (
		!order.invoiceNumber ||
		!order.email ||
		!order.invoiceUrl ||
		!order.date ||
		!["Card", "Bank transfer"].includes(order.method) ||
		!Number.isSafeInteger(order.tokens) ||
		order.tokens <= 0 ||
		!Number.isFinite(order.amount) ||
		order.amount <= 0
	)
		throw new Error("Incomplete receipt data.");
	const url = new URL(order.invoiceUrl);
	if (!["https:", "http:"].includes(url.protocol))
		throw new Error("Invalid invoice URL.");
	const name = order.buyerName || order.email;
	const amount = `€${order.amount.toFixed(2)}`;
	const tokens = order.tokens.toLocaleString("en-US");
	const adjusted =
		Number.isFinite(order.orderedEur) && order.orderedEur > order.amount
			? `\n\nYour original order was €${order.orderedEur.toFixed(2)}. We received €${order.amount.toFixed(2)} and adjusted your purchase to ${tokens} tokens.`
			: "";
	const subject = `Velora AI — Receipt ${order.invoiceNumber} for your balance top-up`;
	const text = `Hello ${name},\n\nThank you for your payment. Your Velora AI balance has been topped up, and ${tokens} tokens have been credited to your account.\n\nInvoice: ${order.invoiceNumber}\nDate: ${order.date}\nPayment method: ${order.method}\nAmount paid: ${amount}\n\nView & download invoice: ${url.href}${adjusted}\n\nIf you have any questions, please contact us at contact@omnix-21.com.\n\nThank you for choosing Velora AI,\nThe Velora AI team`;
	const e = escapeHtml;
	const html = `<div style="background:#faf5ed;padding:32px 16px;font-family:Arial,sans-serif;color:#252525"><div style="max-width:560px;margin:auto;background:white;padding:32px;border-radius:16px"><h1 style="color:#ed642b;font-size:24px">Velora AI</h1><p>Hello ${e(name)},</p><p>Thank you for your payment. Your Velora AI balance has been topped up, and <strong>${e(tokens)} tokens</strong> have been credited to your account.</p><p><strong>Invoice:</strong> ${e(order.invoiceNumber)}<br><strong>Date:</strong> ${e(order.date)}<br><strong>Payment method:</strong> ${e(order.method)}<br><strong>Amount paid:</strong> ${e(amount)}</p><p style="margin:28px 0"><a href="${e(url.href)}" style="background:#ed642b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">View &amp; download invoice</a></p>${adjusted?`<p>Your original order was <strong>€${e(order.orderedEur.toFixed(2))}</strong>. We received <strong>€${e(order.amount.toFixed(2))}</strong> and adjusted your purchase to <strong>${e(tokens)} tokens</strong>.</p>`:""}<p>If you have any questions, please contact us at <a href="mailto:contact@omnix-21.com">contact@omnix-21.com</a>.</p><p>Thank you for choosing Velora AI,<br>The Velora AI team</p></div></div>`;
	return { subject, text, html };
}
