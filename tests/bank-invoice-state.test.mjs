import test from "node:test";
import assert from "node:assert/strict";
import { bankInvoicePayment } from "../lib/bank-invoice-state.mjs";
const payment = (amount_cents, currency = "EUR") => ({
	amount_cents,
	currency,
	bank_ref: "bank-ref",
	payment_ref: "transfer-ref",
});
test("credited full EUR payment shows true paid amount and bank reference", () => {
	assert.deepEqual(
		bankInvoicePayment({ status: "credited", eur_amount: 20 }, [
			payment(1000),
			payment(1200),
		]),
		{ paid: true, paidCents: 2200, refs: ["bank-ref", "bank-ref"] },
	);
});
test("pending, partial, absent and non-EUR payments never claim paid", () => {
	for (const [order, payments] of [
		[{ status: "review", eur_amount: 20 }, [payment(2000)]],
		[{ status: "credited", eur_amount: 20 }, [payment(1999)]],
		[{ status: "credited", eur_amount: 20 }, []],
		[{ status: "credited", eur_amount: 20 }, [payment(2000, "USD")]],
	])
		assert.equal(bankInvoicePayment(order, payments).paid, false);
});
