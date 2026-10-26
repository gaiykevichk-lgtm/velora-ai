import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Resend SMTP defaults use the API key as password without exposing it", () => {
  const script = `
    const { verificationConfig, isSmtpConfigured } = require('./lib/verify-email.ts');
    process.env.RESEND_API_KEY = 'test-only-key';
    process.env.SMTP_FROM = 'Velora <no-reply@veloraai.pro>';
    process.env.APP_BASE_URL = 'https://veloraai.pro/';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    const config = verificationConfig();
    if (config.host !== 'smtp.resend.com' || config.port !== 587 || config.user !== 'resend' || config.pass !== 'test-only-key' || config.base !== 'https://veloraai.pro' || !isSmtpConfigured()) process.exit(2);
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
