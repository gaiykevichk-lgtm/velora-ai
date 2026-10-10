import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const content = readFileSync("app/site-content.tsx", "utf8");
const routing = readFileSync("app/[slug]/page.tsx", "utf8");
test("editorial routes have real sections and shared navigation", () => {
	for (const name of [
		"about",
		"guide",
		"faq",
		"availability",
		"privacy",
		"terms",
	]) {
		assert.match(content, new RegExp(`\\b${name}: \\{`));
		assert.match(content, new RegExp(`/${name}`));
	}
	assert.match(routing, /generateStaticParams/);
	assert.match(routing, /notFound\(\)/);
	assert.match(content, /SiteHeader/);
	assert.match(content, /SiteFooter/);
	assert.ok(existsSync("app/editorial.css"));
});
test("product copy reflects transparent token pricing and provider rules", () => {
	assert.match(content, /velora uses a pay-as-you-create token system/);
	assert.match(content, /No recurring subscriptions/);
	assert.match(content, /Starter Package/);
});
