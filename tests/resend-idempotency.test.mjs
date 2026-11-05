import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const source = readFileSync(
	new URL("../lib/verify-email.ts", import.meta.url),
	"utf8",
);
const js = ts.transpileModule(source, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022,
	},
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", js)(
	createRequire(import.meta.url),
	mod,
	mod.exports,
);
test("Resend receipt requests carry stable idempotency key", async () => {
	const oldFetch = globalThis.fetch;
	const oldKey = process.env.RESEND_API_KEY;
	const oldFrom = process.env.SMTP_FROM;
	process.env.RESEND_API_KEY = "re_test";
	process.env.SMTP_FROM = "Velora <test@example.com>";
	let header;
	globalThis.fetch = async (_url, opts) => {
		header = opts.headers["Idempotency-Key"];
		return new Response('{"id":"message"}', { status: 200 });
	};
	try {
		await mod.exports.sendHtmlMail(
			"buyer@example.com",
			"Receipt",
			"text",
			"<p>text</p>",
			"receipt/card/abc",
		);
		assert.equal(header, "receipt/card/abc");
	} finally {
		globalThis.fetch = oldFetch;
		if (oldKey === undefined) delete process.env.RESEND_API_KEY;
		else process.env.RESEND_API_KEY = oldKey;
		if (oldFrom === undefined) delete process.env.SMTP_FROM;
		else process.env.SMTP_FROM = oldFrom;
	}
});
