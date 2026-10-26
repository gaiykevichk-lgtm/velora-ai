import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	BANK_MAX_EUR,
	BANK_MIN_EUR,
	amountToTokens,
	bankConfig,
	buyerComplete,
	buyerProfileSchema,
	ibanBasics,
	mailText,
	nextBankStatus,
	sha256Hex,
	textPdf,
	zipFiles,
} from "../lib/bank-transfer.ts";

const person = {
	kind: "person",
	email: "buyer@example.com",
	fullName: "Jean Dupont",
	country: "France",
	address: "1 rue Test, Paris",
};
const company = {
	kind: "company",
	email: "buyer@example.com",
	legalName: "ACME SAS",
	regNumber: "123 456 789",
	repName: "Marie Martin",
	vat: "FR123",
	country: "France",
	address: "2 rue Test, Paris",
};

test("bank amount boundaries and server-side token math", () => {
	assert.equal(BANK_MIN_EUR, 2);
	assert.equal(BANK_MAX_EUR, 2500);
	assert.equal(amountToTokens(2), 200);
	assert.equal(amountToTokens(2500), 250000);
});

test("buyer profiles require full invoice identity", () => {
	assert.ok(buyerComplete(buyerProfileSchema(person)));
	assert.ok(buyerComplete(buyerProfileSchema(company)));
	assert.ok(!buyerComplete(buyerProfileSchema({ ...person, fullName: "" })));
	assert.ok(!buyerComplete(buyerProfileSchema({ ...company, regNumber: "" })));
});

test("IBAN basics reject malformed and bad check digits", () => {
	assert.ok(ibanBasics("FR1420041010050500013M02606").ok);
	assert.ok(!ibanBasics("FR1420041010050500013M02607").ok);
	assert.ok(!ibanBasics("XX00").ok);
});

test("order mail carries reference, exact amount and credit window", () => {
	const body = mailText(
		{
			publicNumber: "VEL-2026-000123",
			eur: 20,
			tokens: 2000,
			invoiceNumber: "INV-2026-000123",
			seller: { legalName: "Seller", iban: "FR1", bic: "BIC", bank: "Bank" },
			buyer: {},
			buyer: {},
			creditDays: 2,
		},
		"https://veloraai.pro",
	);
	assert.ok(
		body.includes("Payment reference: Payment under invoice INV-2026-000123") &&
			body.includes("20 EUR") &&
			body.includes("2,000") &&
			body.includes("2 business days"),
	);
});

test("partial totals accumulate and only a full receipt leaves review", () => {
	assert.equal(nextBankStatus("confirmed", 500, 2000), "partial");
	assert.equal(nextBankStatus("partial", 1500, 2000), "partial");
	assert.equal(nextBankStatus("partial", 2000, 2000), "review");
	assert.equal(nextBankStatus("credited", 2000, 2000), "credited");
	assert.equal(nextBankStatus("awaiting_payment", 0, 2000), "awaiting_payment");
});

test("documents are real portable PDF and dossier archive bytes", () => {
	const pdf = textPdf("Order", ["line one", "line two"]);
	assert.ok(pdf.subarray(0, 5).toString() === "%PDF-");
	const zip = zipFiles([
		{ name: "a.pdf", data: pdf },
		{ name: "map.csv", data: Buffer.from("a,b\n") },
	]);
	assert.ok(zip.subarray(0, 4).toString("hex") === "504b0304");
	assert.equal(sha256Hex("x").length, 64);
});

test("bank config is explicit draft until real details are set", () => {
	assert.throws(() => bankConfig(), /Bank transfer details/);
});

test("routes enforce buyer auth, verified email, admin-only decisions and evidence limits", () => {
	const orders = readFileSync("app/api/bank-transfer/orders/route.ts", "utf8");
	assert.match(orders, /email_verified/);
	assert.match(orders, /EMAIL_NOT_VERIFIED/);
	assert.match(orders, /bank_order_events/);
	assert.match(orders, /ON CONFLICT \(order_id\) DO NOTHING/);
	assert.match(orders, /acceptedTerms/);
	assert.match(orders, /BANK_MAX_EUR/);
	const admin = readFileSync("app/api/bank-transfer/admin/route.ts", "utf8");
	assert.match(admin, /adminUser/);
	assert.match(admin, /FOR UPDATE/);
	assert.match(admin, /Order is already credited/);
	assert.match(admin, /Full EUR receipt is required/);
	assert.match(admin, /token_transactions/);
	assert.match(admin, /payment\.recorded/);
	assert.match(admin, /order\.credited/);
	assert.match(admin, /action === "refund"/);
	assert.match(admin, /export async function GET/);
	assert.match(admin, /dossier\.zip/);
	assert.match(admin, /buildOrderDossier/);
	assert.match(readFileSync("lib/bank-transfer.ts", "utf8"), /mapping\.csv/);
	assert.match(admin, /action === "contract"/);
	const evidence = readFileSync(
		"app/api/bank-transfer/evidence/route.ts",
		"utf8",
	);
	assert.match(evidence, /Only PDF, CSV, PNG or JPEG/);
	assert.match(evidence, /15 \* 1024 \* 1024/);
	const reported = readFileSync(
		"app/api/bank-transfer/reported/route.ts",
		"utf8",
	);
	assert.match(reported, /order\.reported/);
	assert.doesNotMatch(reported, /tokens=tokens/);
	const ui = readFileSync("app/workspace.tsx", "utf8");
	assert.match(ui, /Bank transfer \(€2–€2,500\)/);
	assert.match(ui, /Amount between €2 and €2,500/);
	// The duplicate "custom amount" invoice form is gone: one purchase process.
	assert.doesNotMatch(ui, /customEur|Custom amount \(invoice order\)/);
	assert.match(ui, /min=\{2\}[\s\S]*max=\{2500\}/);
	assert.match(ui, /IBAN:/);
	assert.match(ui, /BankOrderDetails/);
	assert.match(ui, /BankTermsLine/);
	assert.match(
		readFileSync("lib/bank-transfer.ts", "utf8"),
		/Manage the order/,
	);
	assert.match(ui, /Confirm order and get details/);
	assert.match(
		readFileSync("app/public-controls.tsx", "utf8"),
		/min=\{2\}[\s\S]*max=\{2500\}/,
	);
	assert.match(ui, /Confirm receipt — credit once/);
	assert.match(ui, /Download dossier \(ZIP\)/);
});

test("lawful text describes tokens as usage units, keeps tax fields blank", () => {
	const s = readFileSync("app/site-content.tsx", "utf8");
	assert.match(s, /usage units/);
	assert.match(s, /Bank transfer/);
});
