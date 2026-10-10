import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("provider credentials stay server-side", () => {
	const env = readFileSync(".env.example", "utf8");
	assert.match(env, /DATABASE_URL=/);
	assert.match(env, /VIDEO_STATUS_URL=/);
	assert.match(env, /TEXT_MODEL=google\/gemini-3\.8-flash/);
	assert.match(env, /IMAGE_MODEL=qwen\/qwen-image-3-pro/);
	assert.match(env, /VIDEO_MODEL=minimax\/hailuo-3/);
	assert.match(env, /TEXT_API_KEY=\n/);
	assert.doesNotMatch(env, /NEXT_PUBLIC_/);
});
test("database contains ownership and expiration constraints", () => {
	const migration = readFileSync("scripts/setup-db.mjs", "utf8");
	assert.match(migration, /user_id uuid NOT NULL REFERENCES users/);
	assert.match(migration, /expires_at timestamptz/);
});
test("self-service token top-ups fail closed without balance mutations", () => {
 const route = readFileSync("app/api/tokens/route.ts", "utf8");
 const post = route.slice(route.indexOf("export async function POST"));
 assert.match(post, /if \(!account\) return unauthorized\(\)/);
 assert.match(post, /TOPUP_DISABLED/);
 assert.match(post, /status: 403/);
 assert.doesNotMatch(post, /\.query\(|UPDATE|INSERT|req\.json|packageId/);
 assert.match(route, /topupEnabled: false/);
});
