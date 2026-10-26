// Guards the transport switch: with RESEND_API_KEY the app must post to the
// Resend HTTPS API (works where outbound SMTP is blocked) and return its id.
// Fetch is stubbed, so no network traffic leaves the test process.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadModule(env) {
	for (const key of ["RESEND_API_KEY", "SMTP_FROM", "SMTP_PASSWORD", "BANK_MAIL_FROM", "APP_BASE_URL", "SMTP_HOST", "SMTP_USER"]) {
		delete process.env[key];
	}
	Object.assign(process.env, env);
	delete require.cache[require.resolve("../lib/verify-email.ts")];
	return require("../lib/verify-email.ts");
}

test("mail is sent through the Resend HTTPS API when a key is present", async () => {
	const mod = loadModule({
		RESEND_API_KEY: "re_test_key",
		SMTP_FROM: "Velora <no-reply@veloraai.pro>",
		APP_BASE_URL: "https://veloraai.pro",
	});
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ id: "resend-message-id" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};
	try {
		assert.equal(mod.mailConfigured(), true);
		const result = await mod.sendPlainMail("buyer@example.com", "Subject line", "Body text");
		assert.equal(result.sent, true);
		assert.equal(result.messageId, "resend-message-id");
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, "https://api.resend.com/emails");
		assert.equal(calls[0].init.method, "POST");
		assert.equal(calls[0].init.headers.Authorization, "Bearer re_test_key");
		const payload = JSON.parse(calls[0].init.body);
		assert.equal(payload.from, "Velora <no-reply@veloraai.pro>");
		assert.deepEqual(payload.to, ["buyer@example.com"]);
		assert.equal(payload.subject, "Subject line");
		assert.equal(payload.text, "Body text");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("an API rejection surfaces as a transport error", async () => {
	const mod = loadModule({
		RESEND_API_KEY: "re_revoked",
		SMTP_FROM: "Velora <no-reply@veloraai.pro>",
		APP_BASE_URL: "https://veloraai.pro",
	});
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(JSON.stringify({ message: "API key is invalid" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	try {
		await assert.rejects(
			() => mod.sendPlainMail("buyer@example.com", "s", "t"),
			/Resend API 401/,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("without a key and sender the transport reports itself unconfigured", () => {
	const mod = loadModule({});
	assert.equal(mod.mailConfigured(), false);
});
