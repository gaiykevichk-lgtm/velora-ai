import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { purchaseReceipt } from "../lib/purchase-receipt.mjs";
function setup({ status = "credited", fail = false, paidCents = 2000 } = {}) {
	let state = "pending",
		sends = 0,
		key,
		payload;
	const pool = {
		async query(sql, args) {
			if (sql.startsWith("SELECT COALESCE(SUM(amount_cents)"))
				return { rows: [{ paid: paidCents }] };
			if (
				sql.startsWith("UPDATE purchase_receipt_outbox SET state='sending'")
			) {
				if (state !== "pending") return { rowCount: 0 };
				state = "sending";
				return { rowCount: 1 };
			}
			if (sql.includes("SET payload="))
				return { rows: [{ payload: JSON.parse(args[2]) }] };
			if (sql.startsWith("SELECT id,email") || sql.startsWith("SELECT o.id"))
				return {
					rows: [
						{
							id: "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
							email: "buyer@example.com",
							eur_amount: 20,
							tokens: 2000,
							status,
							credit_date: "2026-11-05T10:00:00Z",
							paid_at: "2026-11-05T10:00:00Z",
							invoice_number: "TU-2026-000001",
							invoice_id: "bank-invoice-id",
							buyer: { fullName: "Test Buyer" },
						},
					],
				};
			if (sql.includes("SET state='sent'")) {
				state = "sent";
				return { rowCount: 1 };
			}
			if (sql.includes("SET state='failed'")) {
				state = "failed";
				return { rowCount: 1 };
			}
			throw Error("Unexpected query");
		},
	};
	const source = fs.readFileSync(
		new URL("../lib/receipt-delivery.ts", import.meta.url),
		"utf8",
	);
	const js = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports = {};
	const sandbox = {
		exports,
		process: { env: { APP_BASE_URL: "https://example.com" } },
		URL,
		Date,
		console,
		require: (path) =>
			path === "./invoice-order"
				? {
						cardInvoice: async () =>
							(await pool.query("SELECT id,email")).rows[0],
					}
				: path === "./db"
					? { dbAsync: async () => pool }
					: path === "./purchase-receipt.mjs"
						? { purchaseReceipt }
						: path === "./verify-email"
							? {
									sendHtmlMail: async (...args) => {
										sends++;
										key = args[4];
										payload = args;
										if (fail) throw Error("timeout");
										return { sent: true, messageId: "message" };
									},
								}
							: null,
	};
	vm.runInNewContext(js, sandbox);
	return {
		deliver: exports.deliverPurchaseReceipt,
		get state() {
			return state;
		},
		get sends() {
			return sends;
		},
		get key() {
			return key;
		},
		get payload() {
			return payload;
		},
	};
}
test("credited order sends once and uses stable provider key", async () => {
	const s = setup();
	await s.deliver("card", "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	await s.deliver("card", "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	assert.equal(s.sends, 1);
	assert.equal(s.state, "sent");
	assert.equal(s.key, "receipt/card/01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	assert.match(s.payload[2], /2,000 tokens/);
});
test("uncredited order and ambiguous delivery do not automatically retry", async () => {
	for (const options of [{ status: "pending" }, { fail: true }]) {
		const s = setup(options);
		await assert.rejects(s.deliver("card", "id"));
		await s.deliver("card", "id");
		assert.equal(s.state, "failed");
		assert.equal(s.sends, options.fail ? 1 : 0);
	}
});

test("bank receipt uses its own invoice, name, amount and tokens and sends once", async () => {
	const s = setup();
	await s.deliver("bank", "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	await s.deliver("bank", "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	assert.equal(s.sends, 1);
	assert.match(s.payload[2], /Test Buyer/);
	assert.match(s.payload[2], /Bank transfer/);
	assert.match(s.payload[2], /doc=bank-invoice-id/);
	assert.match(s.payload[2], /€20.00/);
});

test("bank receipt shows actual paid EUR matching invoice total on overpayment", async () => {
	const s = setup({ paidCents: 2200 });
	await s.deliver("bank", "01234567-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	assert.match(s.payload[2], /Amount paid: €22.00/);
});
