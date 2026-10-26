import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
test("provider credentials stay server-side", () => {
	const env = readFileSync(".env.example", "utf8");
	assert.match(env, /DATABASE_URL=/);
	assert.match(env, /VIDEO_STATUS_URL=/);
	assert.match(env, /TEXT_MODEL=google\/gemini-3\.8-flash/);
	assert.match(env, /IMAGE_MODEL=qwen\/qwen-image-3-pro/);
	assert.match(env, /IMAGE_EDIT_MODEL=google\/gemini-3\.1-flash-image-preview/);
	assert.match(env, /VIDEO_MODEL=minimax\/hailuo-3/);
	assert.match(env, /TEXT_API_KEY=\n/);
	assert.doesNotMatch(env, /NEXT_PUBLIC_/);
});
test("database contains ownership and expiration constraints", () => {
	const migration = readFileSync("scripts/setup-db.mjs", "utf8");
	assert.match(migration, /user_id uuid NOT NULL REFERENCES users/);
	assert.match(migration, /expires_at timestamptz/);
 assert.match(migration, /bank_orders/);
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

test("one purchase process: bank transfer order, admin-confirmed credit only", () => {
 // The legacy duplicate "custom amount" invoice route is removed; the bank
 // transfer order is the single manual purchase flow.
 assert.equal(existsSync("app/api/orders/route.ts"), false);
 const route = readFileSync("app/api/bank-transfer/orders/route.ts", "utf8");
 assert.match(route, /awaiting_payment|bank_orders/);
 assert.match(readFileSync("app/api/bank-transfer/admin/route.ts", "utf8"), /grantTokens/);
 assert.match(readFileSync("lib/tokens.ts", "utf8"), /TOKEN_VALIDITY_MONTHS = 12/);
 assert.match(readFileSync("lib/admin.ts", "utf8"), /ADMIN_EMAILS/);
});
test("registration creates an unverified account with a confirmation link", () => {
 const route = readFileSync("app/api/auth/route.ts", "utf8");
 assert.match(route, /email_verified/);
 assert.match(route, /email_verifications/);
 assert.match(route, /EMAIL_NOT_VERIFIED/);
 assert.match(route, /sendVerificationEmail/);
 assert.match(readFileSync("app/api/auth/verify/route.ts", "utf8"), /expires_at/);
 assert.match(readFileSync("lib/verify-email.ts", "utf8"), /SMTP_HOST/);
 assert.match(readFileSync("lib/db.ts", "utf8"), /email_verifications/);
 assert.match(readFileSync(".env.example", "utf8"), /SMTP_HOST=/);
 assert.match(readFileSync("render.yaml", "utf8"), /SMTP_HOST/);
});
test("generation requires a verified email", () => {
 const route = readFileSync("app/api/runs/route.ts", "utf8");
 const post = route.slice(route.indexOf("export async function POST"));
 assert.match(post, /email_verified/);
 assert.match(post, /EMAIL_NOT_VERIFIED/);
});
