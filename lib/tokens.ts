// Prepaid token lots. Every credit creates a lot with its own 12-month expiry
// date, so the published rule "valid for 12 months from the credit date" is
// actually enforced instead of being a text-only promise.
import { randomUUID } from "node:crypto";

export const TOKEN_VALIDITY_MONTHS = 12;

export type TokenLot = {
	id: string;
	remaining: number;
	expires_at: Date | string;
};

export type ConsumptionPlan = {
	consume: { id: string; take: number }[];
	expired: string[];
	shortfall: number;
};

// Pure helper: spend the oldest lots first (first expired, first out).
export function planConsumption(
	lots: TokenLot[],
	amount: number,
	now: Date = new Date(),
): ConsumptionPlan {
	const expired: string[] = [];
	const live: TokenLot[] = [];
	for (const lot of lots) {
		const until = new Date(lot.expires_at).getTime();
		if (Number.isFinite(until) && until <= now.getTime()) expired.push(lot.id);
		else if (Number(lot.remaining) > 0) live.push(lot);
	}
	live.sort(
		(a, b) =>
			new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
	);
	const consume: { id: string; take: number }[] = [];
	let left = Math.max(0, Math.floor(amount));
	for (const lot of live) {
		if (left <= 0) break;
		const take = Math.min(left, Number(lot.remaining));
		consume.push({ id: lot.id, take });
		left -= take;
	}
	return { consume, expired, shortfall: left };
}

type Queryable = {
	query: (...args: any[]) => Promise<any>;
	connect?: () => Promise<any>;
};

// Expire lots whose date has passed and rebuild the spendable balance from the
// lots themselves. Accounts created before lot tracking keep their old balance.
export async function syncTokenBalance(
	pool: Queryable,
	userId: string,
): Promise<{ tokens: number; expiresAt: string | null }> {
	await pool.query(
		"UPDATE token_lots SET remaining=0 WHERE user_id=$1 AND expires_at<=now() AND remaining>0",
		[userId],
	);
	const lots = await pool.query(
		"SELECT count(*)::int AS count, COALESCE(sum(remaining),0)::int AS tokens, max(expires_at) AS expires_at FROM token_lots WHERE user_id=$1",
		[userId],
	);
	const row = lots.rows[0];
	if (row && Number(row.count) > 0) {
		const tokens = Number(row.tokens) || 0;
		await pool.query("UPDATE users SET tokens=$2 WHERE id=$1", [
			userId,
			tokens,
		]);
		return {
			tokens,
			expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
		};
	}
	const account = await pool.query("SELECT tokens FROM users WHERE id=$1", [
		userId,
	]);
	return {
		tokens: Number(account.rows[0]?.tokens ?? 0),
		expiresAt: null,
	};
}

// Credit a purchase: one lot with its own expiry, plus the running balance.
// Balances credited before lot tracking existed are carried over as their own
// lot the first time, so an old balance is never dropped by the reconciliation.
export async function grantTokens(
	client: Queryable,
	userId: string,
	tokens: number,
	source: string,
	months: number = TOKEN_VALIDITY_MONTHS,
) {
	const known = await client.query(
		"SELECT count(*)::int AS count FROM token_lots WHERE user_id=$1",
		[userId],
	);
	if (!Number(known.rows[0]?.count ?? 0)) {
		const account = await client.query("SELECT tokens FROM users WHERE id=$1", [
			userId,
		]);
		const carried = Number(account.rows[0]?.tokens ?? 0);
		if (carried > 0)
			await client.query(
				"INSERT INTO token_lots (id,user_id,tokens,remaining,expires_at,source) VALUES ($1,$2,$3,$3,now()+($4 || ' months')::interval,$5)",
				[
					randomUUID(),
					userId,
					carried,
					String(months),
					"Carried-over balance before purchase tracking",
				],
			);
	}
	await client.query(
		"INSERT INTO token_lots (id,user_id,tokens,remaining,expires_at,source) VALUES ($1,$2,$3,$3,now()+($4 || ' months')::interval,$5)",
		[randomUUID(), userId, tokens, String(months), source],
	);
	await client.query("UPDATE users SET tokens=tokens+$1 WHERE id=$2", [
		tokens,
		userId,
	]);
}

// Spend tokens oldest-first. Returns the fresh balance when the charge succeeded.
export async function spendTokens(
	pool: Queryable,
	userId: string,
	cost: number,
): Promise<{ ok: boolean; tokens: number }> {
	await syncTokenBalance(pool, userId);
	const { rows } = await pool.query(
		"SELECT id,remaining,expires_at FROM token_lots WHERE user_id=$1 AND remaining>0 AND expires_at>now() ORDER BY expires_at ASC, created_at ASC",
		[userId],
	);
	if (!rows.length) {
		// Legacy balance without lot tracking: keep the original atomic update.
		const deducted = await pool.query(
			"UPDATE users SET tokens=tokens-$1 WHERE id=$2 AND tokens >= $1 RETURNING tokens",
			[cost, userId],
		);
		return {
			ok: Boolean(deducted.rowCount),
			tokens: Number(deducted.rows[0]?.tokens ?? 0),
		};
	}
	const plan = planConsumption(rows as TokenLot[], cost);
	if (plan.shortfall > 0) {
		const balance = rows.reduce(
			(sum: number, lot: TokenLot) => sum + Number(lot.remaining),
			0,
		);
		return { ok: false, tokens: balance };
	}
	for (const item of plan.consume)
		await pool.query(
			"UPDATE token_lots SET remaining=remaining-$2 WHERE id=$1",
			[item.id, item.take],
		);
	const synced = await syncTokenBalance(pool, userId);
	return { ok: true, tokens: synced.tokens };
}
