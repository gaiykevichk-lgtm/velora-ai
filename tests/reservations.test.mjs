import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newDb, DataType } from "pg-mem";
import {
	grantTokens,
	reserveTokens,
	captureReservation,
	releaseReservation,
	reservedTokens,
	syncTokenBalance,
} from "../lib/tokens.ts";
import { matchesAspect, imageDimensions, IMAGE_SIZES } from "../lib/image-format.ts";

async function freshDb() {
	const src = readFileSync("lib/db.ts", "utf8");
	const schema = /const SCHEMA = `([\s\S]*?)`;/.exec(src)[1];
	const mem = newDb();
	mem.public.registerFunction({ name: "now", returns: DataType.timestamptz, implementation: () => new Date() });
	const { Pool } = mem.adapters.createPg();
	const pool = new Pool();
	for (const st of schema.split(";\n").filter((x) => x.trim())) await pool.query(st);
	return pool;
}
const uid = "11111111-1111-1111-1111-111111111111";
async function setup() {
	const pool = await freshDb();
	await pool.query("INSERT INTO users (id,email,password_hash,tokens) VALUES ($1,'a@b.c','x',0)", [uid]);
	await grantTokens(pool, uid, 300, "test");
	return pool;
}

test("reserve holds tokens, capture charges once", async () => {
	const pool = await setup();
	const run = "22222222-2222-2222-2222-222222222222";
	const r = await reserveTokens(pool, uid, run, 100);
	assert.equal(r.ok, true);
	assert.equal(r.tokens, 200);
	assert.equal(await reservedTokens(pool, uid), 100);
	assert.equal(await captureReservation(pool, run, "Generation: video"), true);
	assert.equal(await captureReservation(pool, run, "Generation: video"), false);
	assert.equal(await releaseReservation(pool, run), false);
	assert.equal(await reservedTokens(pool, uid), 0);
	const tx = await pool.query("SELECT amount FROM token_transactions WHERE user_id=$1", [uid]);
	assert.equal(tx.rowCount, 1);
	assert.equal((await syncTokenBalance(pool, uid)).tokens, 200);
});

test("release returns tokens once and never after capture", async () => {
	const pool = await setup();
	const run = "33333333-3333-3333-3333-333333333333";
	await reserveTokens(pool, uid, run, 100);
	assert.equal(await releaseReservation(pool, run), true);
	assert.equal(await releaseReservation(pool, run), false);
	assert.equal(await captureReservation(pool, run, "x"), false);
	assert.equal((await syncTokenBalance(pool, uid)).tokens, 300);
	const tx = await pool.query("SELECT 1 FROM token_transactions WHERE user_id=$1", [uid]);
	assert.equal(tx.rowCount, 0);
});

test("cannot reserve more than the balance", async () => {
	const pool = await setup();
	const r = await reserveTokens(pool, uid, "44444444-4444-4444-4444-444444444444", 400);
	assert.equal(r.ok, false);
	assert.equal(await reservedTokens(pool, uid), 0);
});

test("image formats map to distinct sizes and are verified from bytes", () => {
	assert.equal(new Set(Object.values(IMAGE_SIZES)).size, 3);
	const png = (w, h) => {
		const b = Buffer.alloc(33);
		b.writeUInt32BE(0x89504e47, 0);
		b.writeUInt32BE(w, 16);
		b.writeUInt32BE(h, 20);
		return b;
	};
	assert.deepEqual(imageDimensions(png(1792, 1024)), { width: 1792, height: 1024 });
	assert.equal(matchesAspect(png(1792, 1024), "16:9"), true);
	assert.equal(matchesAspect(png(1024, 1024), "16:9"), false);
	assert.equal(matchesAspect(png(1024, 1792), "9:16"), true);
	assert.equal(matchesAspect(png(1024, 1024), "1:1"), true);
});
