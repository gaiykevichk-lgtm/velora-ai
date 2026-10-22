import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class BankConfigError extends Error {}

export const BANK_MIN_EUR = 1;
export const BANK_MAX_EUR = 2500;

export function bankConfig() {
	const seller = {
		legalName: process.env.BANK_SELLER_NAME?.trim() ?? "",
		iban: (process.env.BANK_SELLER_IBAN ?? "")
			.replace(/\s+/g, "")
			.toUpperCase(),
		bic: (process.env.BANK_SELLER_BIC ?? "").replace(/\s+/g, "").toUpperCase(),
		bank: process.env.BANK_SELLER_BANK?.trim() ?? "",
		country: process.env.BANK_SELLER_COUNTRY?.trim() ?? "",
		address: process.env.BANK_SELLER_ADDRESS?.trim() ?? "",
	};
	const termsVersion =
		process.env.BANK_TERMS_VERSION?.trim() || "2026-10-26-v1";
	const termsText =
		process.env.BANK_TERMS_TEXT?.trim() ||
		"DRAFT — replace BANK_TERMS_VERSION and BANK_TERMS_TEXT before commercial launch.";
	const validityMonths = Number(process.env.BANK_TOKEN_VALIDITY_MONTHS ?? "12");
	const creditDays = Number(process.env.BANK_CREDIT_DAYS_AFTER_RECEIPT ?? "2");
	if (
		!process.env.DATABASE_URL ||
		!seller.legalName ||
		!seller.iban ||
		!seller.bic ||
		!seller.bank ||
		!seller.country ||
		!seller.address ||
		!Number.isInteger(validityMonths) ||
		validityMonths < 1 ||
		validityMonths > 24 ||
		!Number.isInteger(creditDays) ||
		creditDays < 0 ||
		creditDays > 30
	)
		throw new BankConfigError("Bank transfer details are not configured yet.");
	return {
		enabled: process.env.BANK_TRANSFER_ENABLED === "true",
		seller,
		termsVersion,
		termsText,
		validityMonths,
		creditDays,
		evidenceDir:
			process.env.BANK_EVIDENCE_DIR?.trim() ||
			"/home/user/velora-ai/.bank-evidence",
	};
}

export function amountToTokens(eur: number) {
	return eur * 100;
}

export function nextBankStatus(
	orderStatus: string,
	paidCents: number,
	amountCents: number,
) {
	if (["cancelled", "refunded", "credited"].includes(orderStatus))
		return orderStatus;
	// No receipt yet: keep the creation state, do not invent a transition.
	if (paidCents <= 0 || amountCents <= 0) return orderStatus;
	if (paidCents >= amountCents) return "review";
	return "partial";
}

const IBAN_LENGTHS: Record<string, number> = {
	FR: 27,
	DE: 22,
	ES: 24,
	IT: 27,
	NL: 18,
	BE: 16,
	IE: 22,
	PT: 25,
	AT: 20,
};
export function ibanBasics(iban: string): { ok: boolean; reason?: string } {
	const v = iban.replace(/\s+/g, "").toUpperCase();
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v))
		return {
			ok: false,
			reason: "IBAN must start with 2 letters and 2 check digits.",
		};
	const expected = IBAN_LENGTHS[v.slice(0, 2)];
	if (expected && v.length !== expected)
		return {
			ok: false,
			reason: `IBAN length for ${v.slice(0, 2)} must be ${expected} characters.`,
		};
	const rearranged = v.slice(4) + v.slice(0, 4);
	const digits = rearranged.replace(/[A-Z]/g, (c) =>
		String(c.charCodeAt(0) - 55),
	);
	let remainder = 0;
	for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97;
	return remainder === 1
		? { ok: true }
		: { ok: false, reason: "IBAN check digits are invalid." };
}

type BuyerInput = Record<string, unknown>;
export function buyerProfileSchema(input: unknown) {
	if (!input || typeof input !== "object") return null;
	const v = input as BuyerInput;
	const str = (x: unknown, max: number) =>
		typeof x === "string" && x.trim().length >= 2 && x.trim().length <= max
			? x.trim()
			: null;
	const base = {
		email: typeof v.email === "string" ? v.email.trim().slice(0, 254) : "",
		country: str(v.country, 80),
		address: str(v.address, 500),
	};
	if (v.kind === "company")
		return {
			kind: "company" as const,
			...base,
			legalName: str(v.legalName, 200),
			regNumber: str(v.regNumber, 80),
			repName: str(v.repName, 120),
			vat:
				typeof v.vat === "string" && v.vat.trim()
					? v.vat.trim().slice(0, 40)
					: null,
		};
	return {
		kind: "person" as const,
		...base,
		fullName: str(v.fullName, 120),
	};
}

export function buyerComplete(b: ReturnType<typeof buyerProfileSchema>) {
	if (!b) return false;
	return Boolean(
		b.country &&
			b.address &&
			(b.kind === "person"
				? b.fullName
				: b.legalName && b.regNumber && b.repName),
	);
}

export function mailText(
	order: {
		publicNumber: string;
		eur: number;
		tokens: number;
		seller: Record<string, string>;
		creditDays: number;
	},
	origin: string,
) {
	return [
		`${order.seller.legalName} accepted order ${order.publicNumber}.`,
		`Prepaid package of ${order.tokens.toLocaleString("en-US")} tokens for Velora AI services, ${order.eur} EUR.`,
		`Recipient: ${order.seller.legalName}, IBAN ${order.seller.iban}, BIC ${order.seller.bic}, ${order.seller.bank}.`,
		`Payment reference: ${order.publicNumber}. Transfer the exact amount from the buyer account.`,
		`Tokens are usage units of the service; this is not an order for specific videos or images. Tokens are credited after receipt, within ${order.creditDays} business days of arrival.`,
		`Manage the order: ${origin}/studio?topup=open&bankOrder=${order.publicNumber}`,
	].join("\n");
}

export async function audit(
	pool: { query: (...a: any[]) => Promise<any> },
	orderId: string | null,
	actor: string,
	action: string,
	detail: Record<string, unknown> = {},
) {
	const { randomUUID } = await import("node:crypto");
	await pool.query(
		"INSERT INTO bank_audit_log (id,order_id,actor_email,action,detail) VALUES ($1,$2,$3,$4,$5)",
		[
			randomUUID(),
			orderId,
			actor.slice(0, 254),
			action.slice(0, 80),
			JSON.stringify(detail).slice(0, 4000),
		],
	);
}

export function sha256Hex(buf: Buffer | string) {
	return createHash("sha256").update(buf).digest("hex");
}

function crc32Table(): Uint32Array {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
}
let CRC_TABLE: Uint32Array | null = null;
function crc32(buf: Buffer) {
	CRC_TABLE ??= crc32Table();
	const table = CRC_TABLE;
	let c = 0xffffffff;
	for (const b of buf) table && (c = table[(c ^ b) & 0xff] ^ (c >>> 8));
	return (c ^ 0xffffffff) >>> 0;
}

export function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
	const enc = new TextEncoder();
	const chunks: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const f of files) {
		const name = enc.encode(
			f.name.replace(/[^A-Za-z0-9._/-]/g, "_").slice(0, 120),
		);
		const header = Buffer.alloc(30);
		header.writeUInt32LE(0x04034b50, 0);
		header.writeUInt16LE(20, 4);
		header.writeUInt16LE(0, 6);
		header.writeUInt16LE(0, 8);
		header.writeUInt16LE(0x28, 10);
		header.writeUInt16LE(0x21, 12);
		header.writeUInt32LE(crc32(f.data), 14);
		header.writeUInt32LE(f.data.length, 18);
		header.writeUInt32LE(f.data.length, 22);
		header.writeUInt16LE(name.length, 26);
		header.writeUInt16LE(0, 28);
		chunks.push(header, Buffer.from(name), f.data);
		const c = Buffer.alloc(46);
		c.writeUInt32LE(0x02014b50, 0);
		c.writeUInt16LE(20, 4);
		c.writeUInt16LE(20, 6);
		c.writeUInt16LE(0, 8);
		c.writeUInt16LE(0, 10);
		c.writeUInt16LE(0x28, 12);
		c.writeUInt16LE(0x21, 14);
		c.writeUInt32LE(crc32(f.data), 16);
		c.writeUInt32LE(f.data.length, 20);
		c.writeUInt32LE(f.data.length, 24);
		c.writeUInt16LE(name.length, 28);
		c.writeUInt32LE(offset, 42);
		central.push(c, Buffer.from(name));
		offset += header.length + name.length + f.data.length;
	}
	const centralDir = Buffer.concat(central);
	const start = offset;
	chunks.push(centralDir);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralDir.length, 12);
	end.writeUInt32LE(start, 16);
	chunks.push(end);
	return Buffer.concat(chunks);
}

export function textPdf(title: string, lines: string[]): Buffer {
	const safe = lines.map((l) =>
		l.replace(/[^\x20-\x7E\xA0-\uFFFF]/g, "?").slice(0, 160),
	);
	const content = [
		"BT /F1 13 Tf 56 760 Td",
		...safe.flatMap((l, i) => [
			`(${l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj`,
			...(i < safe.length - 1 ? ["0 -20 Td"] : []),
		]),
		"ET",
	].join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Title (${title.slice(0, 80)}) >>`,
	];
	let out = "%PDF-1.4\n";
	const offsets: number[] = [];
	for (let i = 0; i < objects.length; i++) {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
	}
	const xref = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `).join("\n")}\n`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return Buffer.from(out, "latin1");
}

export async function buildOrderDossier(
	pool: { query: (...a: any[]) => Promise<any> },
	orderId: string,
	evidenceDir: string,
) {
	const order = (
		await pool.query("SELECT * FROM bank_orders WHERE id=$1", [orderId])
	).rows[0];
	if (!order) return null;
	const payments = (
		await pool.query(
			"SELECT * FROM bank_payments WHERE order_id=$1 ORDER BY created_at",
			[orderId],
		)
	).rows;
	const docs = (
		await pool.query(
			"SELECT * FROM bank_order_documents WHERE order_id=$1 ORDER BY created_at",
			[orderId],
		)
	).rows;
	const mail =
		(
			await pool.query("SELECT * FROM bank_mail_log WHERE order_id=$1", [
				orderId,
			])
		).rows[0] ?? null;
	const history = (
		await pool.query(
			"SELECT * FROM bank_audit_log WHERE order_id=$1 ORDER BY created_at",
			[orderId],
		)
	).rows;
	const refunds = (
		await pool.query(
			"SELECT * FROM bank_refunds WHERE order_id=$1 ORDER BY decided_at",
			[orderId],
		)
	).rows;
	const evidence = (
		await pool.query(
			"SELECT id,file_name,mime FROM bank_evidence WHERE order_id=$1 ORDER BY created_at",
			[orderId],
		)
	).rows;
	const summary = docsFor(order, payments, docs, mail, history);
	const buyerAny = order.buyer as Record<string, string>;
	const mapCsv = [
		"order_number,document_kind,document_number,bank_operation,bank_ref,amount_eur,tokens_credit,state",
		...docs.map((d: any) =>
			[
				order.public_number,
				d.kind,
				d.doc_number,
				payments.map((p: any) => p.bank_ref || p.payment_ref).join("|") ||
					"pending",
				payments.map((p: any) => p.bank_ref || "").join("|"),
				Number(order.eur_amount),
				summary.order.status === "credited" ||
				summary.order.status === "refunded"
					? Number(order.tokens)
					: 0,
				summary.order.status,
			].join(","),
		),
	].join("\n");
	const cover = textPdf(`Dossier ${order.public_number}`, [
		`Dossier for order ${order.public_number} — generated ${new Date().toISOString()}`,
		`Buyer snapshot and seller snapshot are stored inside the order; later profile edits do not rewrite them.`,
		`Mapping: order ${summary.order.number} / invoice ${docs.find((d: any) => d.kind === "invoice")?.doc_number ?? "n/a"} / bank ops ${payments.map((p: any) => p.bank_ref || p.payment_ref).join(", ") || "pending"} / credited ${summary.order.status === "credited" || summary.order.status === "refunded" ? "yes" : "not yet"}.`,
		`Buyer: ${order.buyer.kind === "company" ? `${buyerAny.legalName}, ${buyerAny.regNumber}` : buyerAny.fullName}, ${buyerAny.country}.`,
		...JSON.stringify(
			{
				...summary,
				refunds: refunds.map((r: any) => ({
					status: r.status,
					eur: Number(r.amount_cents) / 100,
					ref: r.bank_ref,
				})),
			},
			null,
			1,
		)
			.split("\n")
			.slice(0, 80),
	]);
	const files = [
		{ name: `dossier-${order.public_number}/cover.pdf`, data: cover },
		{
			name: `dossier-${order.public_number}/mapping.csv`,
			data: Buffer.from(mapCsv, "utf8"),
		},
		{
			name: `dossier-${order.public_number}/mail.txt`,
			data: Buffer.from(
				mail
					? `To: ${mail.to_email}\nSubject: ${mail.subject}\nState: ${mail.state}\nMessage: ${mail.message_id}\n\n${mail.body}`
					: "No mail record",
				"utf8",
			),
		},
	];
	for (const doc of docs as any[])
		files.push({
			name: `dossier-${order.public_number}/${doc.kind}-${doc.doc_number}.pdf`,
			data: textPdf(`${doc.kind} ${doc.doc_number}`, [
				`${doc.kind}: ${doc.doc_number} v${doc.version}`,
				`Order ${order.public_number}: ${Number(order.tokens).toLocaleString("en-US")} tokens, ${Number(order.eur_amount)} EUR.`,
				`Terms ${order.terms_version}.`,
			]),
		});
	for (const row of evidence as any[]) {
		try {
			const p = join(evidenceDir, orderId, row.file_name);
			if (p.includes("..")) continue;
			files.push({
				name: `dossier-${order.public_number}/evidence-${row.file_name}`,
				data: await readFile(p).catch(() =>
					Buffer.from(
						`Generated file ${row.file_name}; regenerate from Documents`,
						"utf8",
					),
				),
			});
		} catch {
			/* keep dossier generation best-effort for unreadable attachments */
		}
	}
	return {
		publicNumber: order.public_number,
		zip: zipFiles(files),
		fileCount: files.length,
	};
}

export function docsFor(
	order: any,
	payments: any[],
	docs: any[],
	mail: any | null,
	auditRows: any[],
) {
	const paidCents = payments.reduce(
		(n, p) => n + Number(p.amount_cents || 0),
		0,
	);
	return {
		order: {
			number: order.public_number,
			status: order.status,
			buyer: order.buyer,
			seller: order.seller,
			termsVersion: order.terms_version,
			amountEur: Number(order.eur_amount),
			tokens: Number(order.tokens),
			confirmedAt: order.confirmed_at,
			paidEur: paidCents / 100,
			remainingEur: Math.max(0, Number(order.eur_amount) - paidCents / 100),
		},
		payments: payments.map((p) => ({
			sender: p.sender_name,
			amount: Number(p.amount_cents) / 100,
			currency: p.currency,
			receivedAt: p.received_at,
			bankRef: p.bank_ref,
			paymentRef: p.payment_ref,
			basis: p.match_basis,
			by: p.decided_by,
		})),
		documents: docs.map((d) => ({
			kind: d.kind,
			number: d.doc_number,
			version: d.version,
			createdAt: d.created_at,
		})),
		mail: mail
			? { sentAt: mail.sent_at, state: mail.state, messageId: mail.message_id }
			: null,
		history: auditRows.map((a) => ({
			at: a.created_at,
			actor: a.actor_email,
			action: a.action,
		})),
	};
}
