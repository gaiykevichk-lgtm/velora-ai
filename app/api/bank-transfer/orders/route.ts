import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import {
	BANK_MAX_EUR,
	BANK_MIN_EUR,
	amountToTokens,
	audit,
	bankConfig,
	buyerProfileSchema,
	buyerComplete,
	mailText,
	textPdf,
} from "@/lib/bank-transfer";
import { mailConfigured, sendPlainMail } from "@/lib/verify-email";

export const runtime = "nodejs";
const buyerSchema = z.object({
	kind: z.enum(["person", "company"]),
	email: z.string().email().max(254),
	fullName: z.string().min(2).max(120).optional(),
	legalName: z.string().min(2).max(200).optional(),
	regNumber: z.string().min(2).max(80).optional(),
	repName: z.string().min(2).max(120).optional(),
	vat: z.string().max(40).optional().nullable(),
	country: z.string().min(2).max(80),
	address: z.string().min(2).max(500),
});
const createSchema = z.object({
	eurAmount: z.number().int().min(BANK_MIN_EUR).max(BANK_MAX_EUR),
	requestId: z.string().uuid(),
	buyer: buyerSchema,
	acceptedTerms: z.literal(true),
});
const CONSENT_TEXT =
	"I accept the purchase terms and refund policy shown for this order.";

function docPdf(
	kind: string,
	docNumber: string,
	order: any,
	cfg: ReturnType<typeof bankConfig>,
) {
	const b = order.buyer as Record<string, string>;
	const buyerLine =
		order.buyer.kind === "company"
			? `${b.legalName}, reg. ${b.regNumber}, rep. ${b.repName}${b.vat ? `, VAT ${b.vat}` : ""}, ${b.country}, ${b.address}`
			: `${b.fullName}, ${b.country}, ${b.address}`;
	return textPdf(`${kind} ${docNumber}`, [
		`${kind}: ${docNumber} (version 1, ${new Date().toISOString().slice(0, 10)})`,
		`Seller: ${cfg.seller.legalName}, ${cfg.seller.address}, ${cfg.seller.country}`,
		`Buyer: ${buyerLine} <${order.email}>`,
		`Order: ${order.public_number}, confirmed ${new Date(order.confirmed_at).toISOString()}`,
		`Prepaid package of ${Number(order.tokens).toLocaleString("en-US")} tokens for Velora AI services, ${order.eur_amount} EUR.`,
		`Recipient: ${cfg.seller.legalName}, IBAN ${cfg.seller.iban}, BIC ${cfg.seller.bic}, ${cfg.seller.bank}.`,
		`Payment reference: Payment under invoice ${order.invoice_number ?? order.public_number}.`,
		`Currency: EUR. Amount: ${Number(order.eur_amount).toFixed(2)} EUR.`,
		`Validity: ${cfg.validityMonths} months from crediting. Credit after receipt within ${cfg.creditDays} business days.`,
		`Terms ${order.terms_version}. Tokens are service usage units, not money and not transferable.`,
	]);
}

async function sendOrderMail(order: any, origin: string) {
	// SMTP plumbing lives in verify-email; order mail reuses it through a
	// direct import-free call to avoid duplicating the SMTP client here.
	const subject = `Order ${order.public_number} accepted — bank transfer details`;
	const body = mailText(
		{
			publicNumber: order.public_number,
			invoiceNumber: order.invoice_number,
			eur: Number(order.eur_amount),
			tokens: Number(order.tokens),
			seller: order.seller,
			creditDays: Number(process.env.BANK_CREDIT_DAYS_AFTER_RECEIPT ?? "2"),
		},
		origin,
	);
	const pool = await dbAsync();
	if (!mailConfigured()) {
		await pool.query(
			"INSERT INTO bank_mail_log (order_id,to_email,subject,body,message_id,state,error) VALUES ($1,$2,$3,$4,$5,'logged-no-smtp','SMTP is not configured; shown to admin only') ON CONFLICT (order_id) DO NOTHING",
			[order.id, order.email, subject, body, `log-${order.id}`],
		);
		return { sent: false, messageId: `log-${order.id}` };
	}
	try {
		const result = await sendPlainMail(order.email, subject, body);
		const sent = result.sent;
		const messageId = result.sent ? result.messageId : `log-${order.id}`;
		if (!result.sent)
			await pool.query(
				"INSERT INTO bank_mail_log (order_id,to_email,subject,body,message_id,state,error) VALUES ($1,$2,$3,$4,$5,'logged-no-smtp','SMTP is not configured; shown to admin only') ON CONFLICT (order_id) DO NOTHING",
				[order.id, order.email, subject, body, messageId],
			);
		else
			await pool.query(
				"INSERT INTO bank_mail_log (order_id,to_email,subject,body,message_id,state,error) VALUES ($1,$2,$3,$4,$5,'sent','') ON CONFLICT (order_id) DO NOTHING",
				[order.id, order.email, subject, body, messageId],
			);
		return { sent, messageId };
	} catch (e) {
		await pool.query(
			"INSERT INTO bank_mail_log (order_id,to_email,subject,body,message_id,state,error) VALUES ($1,$2,$3,$4,$5,'failed',$6) ON CONFLICT (order_id) DO NOTHING",
			[
				order.id,
				order.email,
				subject,
				body,
				"",
				(e as Error).message.slice(0, 500),
			],
		);
		return { sent: false, messageId: "" };
	}
}

export async function POST(req: NextRequest) {
	try {
		const cfg = bankConfig();
		const account = await user();
		if (!account) return unauthorized();
		if (!account.email_verified)
			return NextResponse.json(
				{
					error: "Confirm your email before ordering.",
					code: "EMAIL_NOT_VERIFIED",
				},
				{ status: 403 },
			);
		if (req.headers.get("origin") !== new URL(process.env.APP_BASE_URL!).origin)
			return NextResponse.json(
				{ error: "Invalid request origin." },
				{ status: 403 },
			);
		const parsed = createSchema.safeParse(await req.json().catch(() => null));
		if (!parsed.success)
			return NextResponse.json(
				{ error: "Check the amount, buyer details and terms acceptance." },
				{ status: 400 },
			);
		const profile = buyerProfileSchema(parsed.data.buyer);
		if (!profile || !buyerComplete(profile))
			return NextResponse.json(
				{ error: "Complete all buyer fields for the invoice." },
				{ status: 400 },
			);
		if (profile.email.toLowerCase() !== account.email.toLowerCase())
			return NextResponse.json(
				{ error: "Buyer email must match the account email." },
				{ status: 400 },
			);
		const pool = await dbAsync();
		if (!("connect" in pool))
			throw new Error("Bank transfer orders require persistent PostgreSQL.");
		const existing = await pool.query(
			"SELECT id FROM bank_order_events WHERE id=$1",
			[parsed.data.requestId],
		);
		const tokens = amountToTokens(parsed.data.eurAmount);
		const year = new Date().getUTCFullYear();
		if (!existing.rowCount) {
			const recent = await pool.query(
				"SELECT count(*)::int AS count FROM bank_orders WHERE user_id=$1 AND confirmed_at>now()-interval '1 hour'",
				[account.id],
			);
			if (recent.rows[0].count >= 10)
				return NextResponse.json(
					{ error: "Too many orders. Try again later." },
					{ status: 429 },
				);
		}
		const client = await (pool as any).connect();
		let order: any;
		try {
			await client.query("BEGIN");
			const dedupe = await client.query(
				"SELECT order_id FROM bank_order_events WHERE id=$1",
				[parsed.data.requestId],
			);
			if (dedupe.rows[0]) {
				const prev = await client.query(
					"SELECT * FROM bank_orders WHERE id=$1",
					[dedupe.rows[0].order_id],
				);
				order = prev.rows[0];
			} else {
				const seq = await client.query(
					"INSERT INTO bank_seq (year,last_no) VALUES ($1,1) ON CONFLICT (year) DO UPDATE SET last_no=bank_seq.last_no+1 RETURNING last_no",
					[year],
				);
				const publicNumber = `VEL-${year}-${String(seq.rows[0].last_no).padStart(6, "0")}`;
				const id = randomUUID();
				const seller = { ...cfg.seller };
				const description = `Prepaid package of ${tokens.toLocaleString("en-US")} tokens for Velora AI services`;
				await client.query(
					"INSERT INTO bank_orders (id,public_number,user_id,email,eur_amount,tokens,buyer,seller,description,terms_version,terms_text,consent_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
					[
						id,
						publicNumber,
						account.id,
						account.email,
						parsed.data.eurAmount,
						tokens,
						JSON.stringify(profile),
						JSON.stringify(seller),
						description,
						cfg.termsVersion,
						cfg.termsText,
						CONSENT_TEXT,
					],
				);
				await client.query(
					"INSERT INTO bank_order_events (id,order_id,kind,payload) VALUES ($1,$2,'order.confirmed',$3)",
					[
						parsed.data.requestId,
						id,
						JSON.stringify({
							eur: parsed.data.eurAmount,
							tokens,
							buyer: profile,
						}),
					],
				);
				await client.query(
					"INSERT INTO bank_buyers (user_id,profile) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET profile=$2,updated_at=now()",
					[account.id, JSON.stringify(profile)],
				);
				for (const [kind, prefix] of [
					["confirmation", "OC"],
					["invoice", "INV"],
				] as const) {
					const docNumber = `${prefix}-${year}-${String(seq.rows[0].last_no).padStart(6, "0")}`;
					await client.query(
						"INSERT INTO bank_order_documents (id,order_id,kind,doc_number,payload) VALUES ($1,$2,$3,$4,$5)",
						[
							randomUUID(),
							id,
							kind,
							docNumber,
							JSON.stringify({ tokens, eur: parsed.data.eurAmount }),
						],
					);
				}
				const rows = await client.query(
					"SELECT * FROM bank_orders WHERE id=$1",
					[id],
				);
				order = rows.rows[0];
				await audit(client, id, account.email, "order.confirmed", {
					publicNumber,
					eur: parsed.data.eurAmount,
					tokens,
				});
			}
			await client.query("COMMIT");
		} catch (e) {
			await client.query("ROLLBACK");
			throw e;
		} finally {
			client.release();
		}
		const origin = new URL(process.env.APP_BASE_URL!).origin;
		const invoiceRow = (
			await pool.query(
				"SELECT doc_number FROM bank_order_documents WHERE order_id=$1 AND kind='invoice' ORDER BY created_at LIMIT 1",
				[order.id],
			)
		).rows[0];
		order.invoice_number = invoiceRow?.doc_number ?? order.public_number;
		const mail = await sendOrderMail(order, origin);
		const pdf = docPdf(
			"Order confirmation",
			`${order.public_number}`,
			order,
			cfg,
		);
		const dir = join(cfg.evidenceDir, order.id);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, `confirmation-${order.public_number}.pdf`), pdf);
		await pool.query(
			"INSERT INTO bank_evidence (id,order_id,file_name,mime,size_bytes,sha256,uploaded_by) VALUES ($1,$2,$3,'application/pdf',$4,$5,'system') ON CONFLICT DO NOTHING",
			[
				randomUUID(),
				order.id,
				`confirmation-${order.public_number}.pdf`,
				pdf.length,
				createHash("sha256").update(pdf).digest("hex"),
			],
		);
		return NextResponse.json(
			{
				order: {
					id: order.id,
					publicNumber: order.public_number,
					eur: Number(order.eur_amount),
					tokens: Number(order.tokens),
					status: order.status,
					buyer: order.buyer,
					seller: {
						legalName: cfg.seller.legalName,
						iban: cfg.seller.iban,
						bic: cfg.seller.bic,
						bank: cfg.seller.bank,
						address: cfg.seller.address,
						country: cfg.seller.country,
					},
					invoiceNumber: order.invoice_number,
					mailSent: mail.sent,
				},
			},
			{ status: 201 },
		);
	} catch (e) {
		return failure(e);
	}
}

export async function GET(req: NextRequest) {
	try {
		// A missing bank configuration must not break the account screen: the
		// buyer gets an empty, clearly labelled list instead of a 500 error.
		let configured = true;
		try {
			bankConfig();
		} catch {
			configured = false;
		}
		const account = await user();
		if (!account) return unauthorized();
		const admin = await adminUser();
		if (!configured && !admin)
			return NextResponse.json(
				{
					orders: [],
					profile: null,
					configured: false,
					reason:
						"Bank transfer orders are not open yet. No payment has been requested.",
				},
				{ headers: { "Cache-Control": "no-store" } },
			);
		const pool = await dbAsync();
		const id = req.nextUrl.searchParams.get("id");
		const mine =
			"SELECT id,public_number,eur_amount,tokens,status,confirmed_at,buyer FROM bank_orders WHERE user_id=$1 ORDER BY confirmed_at DESC LIMIT 50";
		if (!admin) {
			if (id) {
				const { rows } = await pool.query(
					"SELECT o.id,o.public_number,o.eur_amount,o.tokens,o.status,o.confirmed_at,o.buyer,o.seller,o.description,o.terms_version,(SELECT doc_number FROM bank_order_documents d WHERE d.order_id=o.id AND d.kind='invoice' ORDER BY d.created_at LIMIT 1) AS invoice_number FROM bank_orders o WHERE o.id=$1 AND o.user_id=$2",
					[id, account.id],
				);
				if (!rows[0])
					return NextResponse.json(
						{ error: "Order not found." },
						{ status: 404 },
					);
				return NextResponse.json({ order: rows[0] });
			}
			const { rows } = await pool.query(mine, [account.id]);
			const profile = await pool.query(
				"SELECT profile FROM bank_buyers WHERE user_id=$1",
				[account.id],
			);
			return NextResponse.json({
				orders: rows,
				profile: profile.rows[0]?.profile ?? null,
			});
		}
		if (id) {
			const order = (
				await pool.query("SELECT * FROM bank_orders WHERE id=$1", [id])
			).rows[0];
			if (!order)
				return NextResponse.json(
					{ error: "Order not found." },
					{ status: 404 },
				);
			const payments = (
				await pool.query(
					"SELECT * FROM bank_payments WHERE order_id=$1 ORDER BY created_at",
					[id],
				)
			).rows;
			const evidence = (
				await pool.query(
					"SELECT id,file_name,mime,size_bytes,sha256,uploaded_by,created_at FROM bank_evidence WHERE order_id=$1 ORDER BY created_at",
					[id],
				)
			).rows;
			const mail =
				(
					await pool.query("SELECT * FROM bank_mail_log WHERE order_id=$1", [
						id,
					])
				).rows[0] ?? null;
			const docs = (
				await pool.query(
					"SELECT * FROM bank_order_documents WHERE order_id=$1 ORDER BY created_at",
					[id],
				)
			).rows;
			const history = (
				await pool.query(
					"SELECT * FROM bank_audit_log WHERE order_id=$1 ORDER BY created_at",
					[id],
				)
			).rows;
			const refunds = (
				await pool.query(
					"SELECT * FROM bank_refunds WHERE order_id=$1 ORDER BY decided_at DESC",
					[id],
				)
			).rows;
			return NextResponse.json({
				order,
				payments,
				evidence,
				mail,
				docs,
				history,
				refunds,
			});
		}
		const { rows } = await pool.query(
			"SELECT id,public_number,email,eur_amount,tokens,status,confirmed_at FROM bank_orders ORDER BY confirmed_at DESC LIMIT 100",
		);
		return NextResponse.json({ orders: rows, isAdmin: true });
	} catch (e) {
		return failure(e);
	}
}
