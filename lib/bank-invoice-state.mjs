// A bank invoice may claim payment and credit only when its ledger proves both.
export function bankInvoicePayment(order, payments) {
	const expected = Number(order.eur_amount) * 100;
	const eurOnly =
		payments.length > 0 &&
		payments.every(
			(p) =>
				p.currency === "EUR" &&
				Number.isSafeInteger(Number(p.amount_cents)) &&
				Number(p.amount_cents) > 0,
		);
	const paidCents = payments.reduce(
		(sum, p) => sum + Number(p.amount_cents),
		0,
	);
	const paid =
		order.status === "credited" &&
		eurOnly &&
		Number.isSafeInteger(expected) &&
		Number.isSafeInteger(paidCents) &&
		paidCents >= expected;
	return {
		paid,
		paidCents,
		refs: paid
			? payments.map((p) => p.bank_ref || p.payment_ref).filter(Boolean)
			: [],
	};
}
