import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	planConsumption,
	TOKEN_VALIDITY_MONTHS,
	syncTokenBalance,
	spendTokens,
	grantTokens,
} from "../lib/tokens.ts";

const now = new Date("2026-10-26T12:00:00Z");
const lot = (id, remaining, days) => ({
	id,
	remaining,
	expires_at: new Date(now.getTime() + days * 86400000),
});

test("purchased tokens expire after 12 months", () => {
	assert.equal(TOKEN_VALIDITY_MONTHS, 12);
});

test("spending consumes the lot that expires first", () => {
	const plan = planConsumption(
		[lot("later", 2000, 300), lot("sooner", 500, 10)],
		700,
		now,
	);
	assert.deepEqual(plan.consume, [
		{ id: "sooner", take: 500 },
		{ id: "later", take: 200 },
	]);
	assert.equal(plan.shortfall, 0);
});

test("expired lots never pay for a run", () => {
	const plan = planConsumption(
		[lot("old", 5000, -1), lot("live", 100, 30)],
		100,
		now,
	);
	assert.deepEqual(plan.expired, ["old"]);
	assert.deepEqual(plan.consume, [{ id: "live", take: 100 }]);
	assert.equal(plan.shortfall, 0);
});

test("insufficient balance is reported instead of overdrawing", () => {
	const plan = planConsumption([lot("live", 50, 30)], 100, now);
	assert.equal(plan.shortfall, 50);
	assert.deepEqual(plan.consume, [{ id: "live", take: 50 }]);
});

function fakePool(rows) {
	const state = { lots: rows.map((r) => ({ ...r })), balance: 0 };
	return {
		state,
		async query(sql, args = []) {
			if (sql.startsWith("UPDATE token_lots SET remaining=0")) {
				for (const l of state.lots)
					if (l.user_id === args[0] && new Date(l.expires_at) <= now)
						l.remaining = 0;
				return { rowCount: 1, rows: [] };
			}
			if (sql.startsWith("SELECT count(*)::int AS count")) {
				const mine = state.lots.filter((l) => l.user_id === args[0]);
				return {
					rows: [
						{
							count: mine.length,
							tokens: mine.reduce((s, l) => s + l.remaining, 0),
							expires_at: mine.length
								? new Date(
										Math.max(
											...mine.map((l) => new Date(l.expires_at).getTime()),
										),
									)
								: null,
						},
					],
				};
			}
			if (sql.startsWith("UPDATE users SET tokens=$2")) {
				state.balance = args[1];
				return { rowCount: 1, rows: [] };
			}
			if (sql.startsWith("SELECT tokens FROM users")) {
				return { rows: [{ tokens: state.balance }] };
			}
			if (sql.startsWith("SELECT id,remaining,expires_at FROM token_lots")) {
				return {
					rows: state.lots
						.filter((l) => l.user_id === args[0] && l.remaining > 0)
						.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at)),
				};
			}
			if (sql.startsWith("UPDATE token_lots SET remaining=remaining-$2")) {
				const target = state.lots.find((l) => l.id === args[0]);
				target.remaining = Math.max(0, target.remaining - args[1]);
				return { rowCount: 1, rows: [] };
			}
			throw new Error(`Unexpected query: ${sql}`);
		},
	};
}

test("expired purchase is dropped from the spendable balance", async () => {
	const pool = fakePool([
		{
			id: "old",
			user_id: "u1",
			remaining: 2000,
			expires_at: new Date("2026-01-01T00:00:00Z"),
		},
		{
			id: "new",
			user_id: "u1",
			remaining: 1000,
			expires_at: new Date("2027-06-01T00:00:00Z"),
		},
	]);
	const before = Date.now;
	Date.now = () => now.getTime();
	try {
		const balance = await syncTokenBalance(pool, "u1");
		assert.equal(balance.tokens, 1000);
		assert.equal(pool.state.balance, 1000);
	} finally {
		Date.now = before;
	}
});

test("run charge is taken from live lots and keeps the balance consistent", async () => {
	const pool = fakePool([
		{
			id: "a",
			user_id: "u1",
			remaining: 60,
			expires_at: new Date("2026-11-01T00:00:00Z"),
		},
		{
			id: "b",
			user_id: "u1",
			remaining: 200,
			expires_at: new Date("2027-03-01T00:00:00Z"),
		},
	]);
	const realNow = Date.now;
	Date.now = () => now.getTime();
	try {
		const result = await spendTokens(pool, "u1", 100);
		assert.equal(result.ok, true);
		assert.equal(result.tokens, 160);
		assert.equal(pool.state.lots[0].remaining, 0);
		assert.equal(pool.state.lots[1].remaining, 160);
	} finally {
		Date.now = realNow;
	}
});

test("credit records one lot with its own expiry date", async () => {
	const calls = [];
	const client = {
		async query(sql, args = []) {
			calls.push({ sql, args });
			if (sql.startsWith("SELECT count(*)::int AS count FROM token_lots"))
				return { rows: [{ count: 1 }], rowCount: 1 };
			return { rowCount: 1, rows: [] };
		},
	};
	await grantTokens(client, "u1", 2000, "Bank transfer VEL-1");
	const inserts = calls.filter((c) => c.sql.includes("INSERT INTO token_lots"));
	assert.equal(inserts.length, 1);
	assert.equal(inserts[0].args[2], 2000);
	assert.equal(
		calls.at(-1).sql.startsWith("UPDATE users SET tokens=tokens+$1"),
		true,
	);
});

test("a balance credited before lot tracking is carried over, not dropped", async () => {
	const calls = [];
	const client = {
		async query(sql, args = []) {
			calls.push({ sql, args });
			if (sql.startsWith("SELECT count(*)::int AS count FROM token_lots"))
				return { rows: [{ count: 0 }], rowCount: 1 };
			if (sql.startsWith("SELECT tokens FROM users"))
				return { rows: [{ tokens: 750 }], rowCount: 1 };
			return { rowCount: 1, rows: [] };
		},
	};
	await grantTokens(client, "u1", 2000, "Bank transfer VEL-2");
	const inserts = calls.filter((c) => c.sql.includes("INSERT INTO token_lots"));
	assert.equal(inserts.length, 2);
	assert.equal(inserts[0].args[2], 750);
	assert.equal(inserts[1].args[2], 2000);
});

test("generation and credit paths use the shared lot helpers", () => {
	const runs = readFileSync("app/api/runs/route.ts", "utf8");
	assert.match(runs, /syncTokenBalance/);
	assert.match(runs, /spendTokens/);
	assert.match(readFileSync("lib/infini.mjs", "utf8"), /grantTokens/);
	assert.match(
		readFileSync("app/api/bank-transfer/admin/route.ts", "utf8"),
		/grantTokens/,
	);
});
