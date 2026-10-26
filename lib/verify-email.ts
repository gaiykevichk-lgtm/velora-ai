// Email verification delivery through Resend's SMTP endpoint (no new dependencies).
// Configuration (all server-side, never NEXT_PUBLIC_*):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD,
//   SMTP_FROM (e.g. "Velora <no-reply@veloraai.pro>"),
//   APP_BASE_URL (e.g. https://veloraai.pro) — used to build the verify link.
// If SMTP is not configured, the verify link is logged to the server console
// and returned to the API caller only in development (never in production).
import { createHash, randomBytes } from "node:crypto";
import { connect, type Socket } from "node:net";
import { connect as connectTls } from "node:tls";

export function verificationConfig() {
	const host = process.env.SMTP_HOST?.trim() || "smtp.resend.com";
	const from = process.env.SMTP_FROM?.trim();
	const base = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
	if (!host || !from || !base) return null;
	return {
		host,
		port: Number(process.env.SMTP_PORT ?? "587") || 587,
		user: process.env.SMTP_USER?.trim() || "resend",
		pass: process.env.RESEND_API_KEY?.trim() || process.env.SMTP_PASSWORD || "",
		from,
		base,
	};
}

export function mailFrom() {
	return (
		process.env.BANK_MAIL_FROM?.trim() ||
		process.env.SMTP_FROM?.trim() ||
		""
	);
}

// Mail can be delivered either through the Resend HTTPS API (preferred: works
// wherever 443 is open, incl. hosts that block outbound SMTP) or classic SMTP.
export function mailConfigured() {
	if (!mailFrom()) return false;
	if (process.env.RESEND_API_KEY?.trim()) return true;
	return verificationConfig() !== null;
}

export function isSmtpConfigured() {
	return mailConfigured();
}

export function newVerificationToken() {
	const token = randomBytes(32).toString("hex");
	return {
		token,
		tokenHash: createHash("sha256").update(token).digest("hex"),
	};
}

export function verificationLink(token: string) {
	const cfg = verificationConfig();
	const base =
		cfg?.base ||
		(process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "") ||
		"http://localhost:3000";
	return `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

function b64(s: string) {
	return Buffer.from(s, "utf8").toString("base64");
}

function escapeHeader(s: string) {
	return s.replace(/[\r\n]+/g, " ").slice(0, 500);
}

async function smtpSend(opts: {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
	to: string;
	subject: string;
	text: string;
}) {
	const lines: string[] = [];
	const send = (data: string) =>
		new Promise<void>((resolve, reject) => {
			sock.write(data, (err) => (err ? reject(err) : resolve()));
		});
	let buffer = "";
	let sock: Socket;
	const ready = (expected: number[]) =>
		new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("SMTP timeout")), 20_000);
			const check = () => {
				const idx = buffer.indexOf("\r\n");
				if (idx < 0) return;
				const line = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);
				if (/^\d{3}-/.test(line)) {
					// Multi-line reply: keep reading.
					check();
					return;
				}
				const code = Number(line.slice(0, 3));
				clearTimeout(timer);
				if (!expected.includes(code)) {
					reject(new Error(`SMTP error: ${line.slice(0, 120)}`));
					return;
				}
				resolve(line);
			};
			const onData = (chunk: Buffer) => {
				buffer += chunk.toString("utf8");
				check();
			};
			sock.once("data", onData);
			// If data already buffered, process immediately.
			if (buffer.includes("\r\n")) {
				sock.off("data", onData);
				check();
			}
		});
	sock = connect({ host: opts.host, port: opts.port });
	sock.setTimeout(20_000);
	await new Promise<void>((resolve, reject) => {
		sock.once("error", reject);
		sock.once("connect", () => {
			sock.off("error", reject);
			resolve();
		});
	});
	try {
		await ready([220]);
		await send(`EHLO velora\r\n`);
		const ehlo = await ready([250]);
		if (opts.port === 587 && /STARTTLS/i.test(ehlo)) {
			await send("STARTTLS\r\n");
			await ready([220]);
			sock = connectTls({
				socket: sock,
				host: opts.host,
				servername: opts.host,
			});
			buffer = "";
			await send(`EHLO velora\r\n`);
			await ready([250]);
		}
		if (opts.user) {
			await send("AUTH LOGIN\r\n");
			await ready([334]);
			await send(`${b64(opts.user)}\r\n`);
			await ready([334]);
			await send(`${b64(opts.pass)}\r\n`);
			await ready([235]);
		}
		await send(
			`MAIL FROM:<${escapeHeader(opts.from.match(/<([^>]+)>/)?.[1] ?? opts.from)}>\r\n`,
		);
		await ready([250]);
		await send(`RCPT TO:<${escapeHeader(opts.to)}>\r\n`);
		await ready([250, 251]);
		await send("DATA\r\n");
		await ready([354]);
		const body =
			`From: ${escapeHeader(opts.from)}\r\n` +
			`To: ${escapeHeader(opts.to)}\r\n` +
			`Subject: ${escapeHeader(opts.subject)}\r\n` +
			`Content-Type: text/plain; charset=utf-8\r\n` +
			`Content-Transfer-Encoding: 8bit\r\n\r\n` +
			`${opts.text.replace(/\r?\n/g, "\r\n")}\r\n.\r\n`;
		await send(body);
		await ready([250]);
		try {
			await send("QUIT\r\n");
		} catch {
			/* best effort */
		}
		for (const l of lines) void l;
	} finally {
		try {
			sock.destroy();
		} catch {
			/* ignore */
		}
	}
}

async function resendSend(opts: {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	text: string;
}) {
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${opts.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: opts.from,
			to: [opts.to],
			subject: opts.subject,
			text: opts.text,
		}),
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Resend API ${res.status}: ${detail.slice(0, 200)}`);
	}
}

async function deliverMail(to: string, subject: string, text: string) {
	const from = mailFrom();
	if (!from) throw new Error("Mail sender is not configured.");
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (apiKey) {
		await resendSend({ apiKey, from, to, subject, text });
		return;
	}
	const cfg = verificationConfig();
	if (!cfg)
		throw new Error("Mail transport is not configured (set RESEND_API_KEY).");
	await smtpSend({
		host: cfg.host,
		port: cfg.port,
		user: cfg.user,
		pass: cfg.pass,
		from,
		to,
		subject,
		text,
	});
}

export async function sendPlainMail(to: string, subject: string, text: string) {
	if (!mailConfigured()) return { sent: false as const, messageId: "" };
	try {
		await deliverMail(to, subject, text);
		return { sent: true as const, messageId: `mail-${Date.now()}` };
	} catch (e) {
		throw new Error(`Mail transport failed: ${(e as Error).message}`);
	}
}

export async function sendVerificationEmail(to: string, token: string) {
	const link = verificationLink(token);
	const subject = "Confirm your Velora account";
	const text =
		`Welcome to Velora!\n\n` +
		`Please confirm your email address by opening this link (valid for 24 hours):\n${link}\n\n` +
		`If you did not create this account, ignore this message.`;
	if (!mailConfigured()) {
		// No transport configured: log for the operator, expose the link only in dev.
		console.log(`[verify] Mail not configured. Verify link for ${to}: ${link}`);
		return { sent: false as const, link };
	}
	try {
		await deliverMail(to, subject, text);
		return { sent: true as const, link: null };
	} catch (e) {
		console.error("[verify] Mail send failed:", (e as Error).message);
		throw new Error("Could not send the confirmation email. Try again later.");
	}
}
