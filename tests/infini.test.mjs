import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
	signRequest,
	verifyWebhook,
	trustedCheckoutUrl,
	confirmedOrderMatches,
	infiniRequest,
	creditVerifiedOrder,
} from "../lib/infini.mjs";

const local = {
	id: "local",
	provider_order_id: "provider",
	user_id: "user",
	eur_amount: 20,
	tokens: 2000,
};
const remote = {
	order_id: "provider",
	client_reference: "local",
	status: "paid",
	amount: "20.000000",
	currency: "EUR",
	exception_tags: [],
};
test("Infini authentication matches official canonical string, Digest and query path", () => {
	const path = "/v1/acquiring/order?order_id=abc";
	const date = "Tue, 21 Jan 2025 12:00:00 GMT";
	const headers = signRequest("key", "secret", "get", path, undefined, date);
	const expected = createHmac("sha256", "secret")
		.update(`key\nGET ${path}\ndate: ${date}\n`)
		.digest("base64");
	assert.ok(headers.Authorization.includes(`signature="${expected}"`));
	assert.equal(headers.Digest, undefined);
	assert.equal(
		signRequest("key", "secret", "POST", "/v1/acquiring/order", "{}", date)
			.Digest,
		`SHA-256=${createHash("sha256").update("{}").digest("base64")}`,
	);
});
test("webhook raw body, constant-time signature input, timestamp and version validation", () => {
	const raw = Buffer.from('{ "event":"order.completed" }');
	const timestamp = String(Math.floor(Date.now() / 1000));
	const sig = createHmac("sha256", "webhook")
		.update(`${timestamp}.event.`)
		.update(raw)
		.digest("hex");
	const headers = new Headers({
		"x-webhook-timestamp": timestamp,
		"x-webhook-event-id": "event",
		"x-webhook-signature": sig,
	});
	assert.equal(verifyWebhook(raw, headers, "webhook"), true);
	assert.equal(verifyWebhook(Buffer.from("{}"), headers, "webhook"), false);
	assert.equal(verifyWebhook(raw, headers, "wrong"), false);
	assert.equal(
		verifyWebhook(raw, headers, "webhook", Date.now() + 7200000),
		false,
	);
	headers.set("x-webhook-signature", "invalid");
	assert.equal(verifyWebhook(raw, headers, "webhook"), false);
	headers.set("x-webhook-signature", sig);
	headers.set("x-webhook-signature-version", "v2");
	assert.equal(verifyWebhook(raw, headers, "webhook"), false);
});
test("fulfillment rejects wrong amount/currency/order/reference, partial/late and exception payments", () => {
	assert.equal(confirmedOrderMatches(remote, local), true);
	for (const patch of [
		{ amount: "19.999999" },
		{ amount: "2e1" },
		{ currency: "USD" },
		{ order_id: "other" },
		{ client_reference: "other" },
		{ status: "processing" },
		{ status: "expired" },
		{ exception_tags: ["late"] },
		{ exception_tags: "bad" },
	])
		assert.equal(confirmedOrderMatches({ ...remote, ...patch }, local), false);
});
test("checkout redirect cannot leave configured HTTPS origin", () => {
	assert.equal(
		trustedCheckoutUrl(
			"https://checkout.infini.money/pay/a",
			"https://checkout.infini.money",
		),
		"https://checkout.infini.money/pay/a",
	);
	for (const url of [
		"https://evil.test/pay",
		"http://checkout.infini.money/pay",
		"https://user:pass@checkout.infini.money/pay",
		"javascript:alert(1)",
	])
		assert.throws(() =>
			trustedCheckoutUrl(url, "https://checkout.infini.money"),
		);
});
test("client sends exactly the digested body, and masks upstream secrets on errors", async () => {
	const config = {
		apiBase: "https://openapi.infini.money",
		keyId: "key",
		secret: "secret",
	};
	const data = await infiniRequest(
		config,
		"POST",
		"/v1/acquiring/order",
		{ request_id: "same-id" },
		async (url, options) => {
			assert.equal(url, "https://openapi.infini.money/v1/acquiring/order");
			assert.equal(options.body, '{"request_id":"same-id"}');
			assert.equal(
				options.headers.Digest,
				`SHA-256=${createHash("sha256").update(options.body).digest("base64")}`,
			);
			assert.equal(options.redirect, "error");
			return Response.json({ order_id: "provider" });
		},
	);
	assert.equal(data.order_id, "provider");
	await assert.rejects(
		() =>
			infiniRequest(
				config,
				"POST",
				"/path",
				{},
				async () => new Response("private-secret", { status: 401 }),
			),
		(e) => !e.message.includes("private-secret"),
	);
});

// Transaction unit double, not a persistence implementation. Serializes connections
// to model the PostgreSQL order row lock; real DB concurrency is a launch gate.
function transactionDouble(failLedger = false) {
	let state = { status: "pending", tokens: 0, ledger: 0, events: [] };
	let tail = Promise.resolve();
	const calls = [];
	return {
		get state() {
			return state;
		},
		calls,
		async connect() {
			const prev = tail;
			let release;
			tail = new Promise((r) => {
				release = r;
			});
			await prev;
			let snapshot;
			return {
				release,
				async query(sql, args = []) {
					calls.push(sql);
					if (sql === "BEGIN") snapshot = structuredClone(state);
					if (sql === "ROLLBACK") state = snapshot;
					if (sql.startsWith("SELECT status"))
						return { rows: [{ status: state.status }] };
					if (sql.startsWith("INSERT INTO payment_events")) {
						if (state.events.includes(args[0])) return { rowCount: 0 };
						state.events.push(args[0]);
						return { rowCount: 1 };
					}
					if (sql.startsWith("UPDATE users")) {
						state.tokens += args[0];
						return { rowCount: 1 };
					}
					if (sql.startsWith("INSERT INTO token_transactions")) {
						if (failLedger) throw new Error("ledger failed");
						state.ledger++;
					}
					if (sql.includes("SET status='credited'")) state.status = "credited";
					if (sql.startsWith("UPDATE payment_orders SET status=$2"))
						state.status = args[1];
					return { rows: [], rowCount: 1 };
				},
			};
		},
	};
}
test("same/different webhook IDs and status reconciliation credit once", async () => {
	const pool = transactionDouble();
	await Promise.all([
		creditVerifiedOrder(pool, local, true, "paid", {
			id: "a",
			kind: "order.completed",
			rawHash: "hash",
		}),
		creditVerifiedOrder(pool, local, true, "paid", {
			id: "a",
			kind: "order.completed",
			rawHash: "hash",
		}),
		creditVerifiedOrder(pool, local, true, "paid", {
			id: "b",
			kind: "order.completed",
			rawHash: "hash",
		}),
		creditVerifiedOrder(pool, local, true, "paid"),
	]);
	assert.equal(pool.state.tokens, 2000);
	assert.equal(pool.state.ledger, 1);
	assert.equal(pool.state.status, "credited");
	assert.ok(pool.calls.some((q) => q.includes("FOR UPDATE")));
	await creditVerifiedOrder(pool, local, false, "expired");
	assert.equal(pool.state.status, "credited");
});
test("failed fulfillment rolls back balance, receipt and ledger", async () => {
	const pool = transactionDouble(true);
	await assert.rejects(() =>
		creditVerifiedOrder(pool, local, true, "paid", {
			id: "a",
			kind: "order.completed",
			rawHash: "hash",
		}),
	);
	assert.equal(pool.state.tokens, 0);
	assert.equal(pool.state.events.length, 0);
	assert.equal(pool.state.status, "pending");
	assert.ok(pool.calls.includes("ROLLBACK"));
});
test("partial/unverified payments never credit and mismatched paid orders go to review", async () => {
	const pool = transactionDouble();
	await creditVerifiedOrder(pool, local, false, "partial_paid");
	assert.equal(pool.state.tokens, 0);
	assert.equal(pool.state.status, "partial_paid");
	await creditVerifiedOrder(pool, local, false, "paid");
	assert.equal(pool.state.status, "review");
	assert.equal(pool.state.ledger, 0);
});
