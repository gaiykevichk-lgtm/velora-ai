import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import { audit, bankConfig, nextBankStatus, buildOrderDossier } from "@/lib/bank-transfer";
import { sendPlainMail } from "@/lib/verify-email";
import { grantTokens } from "@/lib/tokens";

export const runtime = "nodejs";
const paymentSchema = z.object({
	orderId: z.string().uuid(),
	senderName: z.string().min(2).max(200),
	amount: z.number().positive().max(100000),
	currency: z.string().regex(/^[A-Z]{3}$/),
	receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	bankRef: z.string().max(200).optional().nullable(),
	paymentRef: z.string().max(200),
	matchBasis: z.string().min(5).max(2000),
	idempotencyKey: z.string().uuid().optional(),
});
const markSchema = z.object({ orderId: z.string().uuid(), note: z.string().max(2000).default("") });
const refundSchema = z.object({
	orderId: z.string().uuid(),
	amount: z.number().positive().max(100000),
	status: z.enum(["requested", "decided", "executed"]),
	reason: z.string().min(2).max(2000),
	bankRef: z.string().max(200).default(""),
	tokenCorrection: z.number().int().min(0).max(1000000).default(0),
});

function eurToCents(n: number) { return Math.round(n * 100); }

export async function GET(req: NextRequest) {
	try {
		const cfg = bankConfig();
		const admin = await adminUser();
		if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
		const orderId = req.nextUrl.searchParams.get("orderId");
		if (!orderId || !z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
		const pool = await dbAsync();
		if (!("connect" in pool)) throw new Error("Bank transfer admin requires persistent PostgreSQL.");
		const dossier = await buildOrderDossier(pool, orderId, cfg.evidenceDir);
		if (!dossier) return NextResponse.json({ error: "Order not found." }, { status: 404 });
		await audit(pool, orderId, admin.email, "dossier.downloaded", { files: dossier.fileCount, via: "GET" });
		return new NextResponse(new Uint8Array(dossier.zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="dossier-${dossier.publicNumber}.zip"` } });
	} catch (e) { return failure(e); }
}

export async function POST(req: NextRequest) {
	try {
		const cfg = bankConfig();
		const admin = await adminUser();
		if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
		const action = req.nextUrl.searchParams.get("action");
		const pool = await dbAsync();
		if (!("connect" in pool)) throw new Error("Bank transfer admin requires persistent PostgreSQL.");
		if (action === "payment") {
			const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
			if (!parsed.success) return NextResponse.json({ error: "Complete all payment fields, including the match basis." }, { status: 400 });
			const p = parsed.data;
			const key = p.idempotencyKey ?? randomUUID();
			const seen = await pool.query("SELECT order_id FROM bank_order_events WHERE id=$1", [key]);
			if (seen.rows[0]) {
				const existing = await pool.query("SELECT * FROM bank_payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 5", [seen.rows[0].order_id]);
				return NextResponse.json({ payment: existing.rows[0] ?? null, duplicate: true });
			}
			const order = (await pool.query("SELECT * FROM bank_orders WHERE id=$1", [p.orderId])).rows[0];
			if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
			if (["cancelled", "refunded"].includes(order.status)) return NextResponse.json({ error: `Order is ${order.status}.` }, { status: 409 });
			const received = new Date(`${p.receivedDate}T12:00:00Z`);
			if (Number.isNaN(received.getTime()) || received > new Date(Date.now() + 86400000)) return NextResponse.json({ error: "Received date is invalid." }, { status: 400 });
			const cents = eurToCents(p.amount);
			const client = await (pool as any).connect();
			let payment: any;
			try {
				await client.query("BEGIN");
				const locked = await client.query("SELECT * FROM bank_orders WHERE id=$1 FOR UPDATE", [p.orderId]);
				const current = locked.rows[0];
				if (["cancelled", "refunded"].includes(current.status)) throw Object.assign(new Error(`Order is ${current.status}.`), { status: 409 });
				if (current.status === "credited") throw Object.assign(new Error("Order is already credited."), { status: 409 });
				await client.query(
					"INSERT INTO bank_payments (id,order_id,sender_name,amount_cents,currency,received_date,bank_ref,payment_ref,match_basis,decided_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
					[randomUUID(), p.orderId, p.senderName.trim(), cents, p.currency, p.receivedDate, p.bankRef?.trim() || null, p.paymentRef.trim(), p.matchBasis.trim(), admin.email],
				).catch((e: any) => {
					if (e?.code === "23505") throw Object.assign(new Error("This bank operation was already recorded for this order."), { status: 409 });
					throw e;
				});
				await client.query("INSERT INTO bank_order_events (id,order_id,kind,payload) VALUES ($1,$2,'payment.recorded',$3)", [key, p.orderId, JSON.stringify({ cents, ref: p.bankRef ?? null, basis: p.matchBasis.slice(0, 200) })]);
				const all = await client.query("SELECT amount_cents FROM bank_payments WHERE order_id=$1", [p.orderId]);
				const paidCents = all.rows.reduce((n: number, r: any) => n + Number(r.amount_cents), 0);
				const full = paidCents >= Number(current.eur_amount) * 100;
				// Manual confirmation only; a payment record never credits by itself.
				const next = p.currency !== "EUR" || !full ? "review" : nextBankStatus(current.status, paidCents, Number(current.eur_amount) * 100);
				await client.query("UPDATE bank_orders SET status=$2,updated_at=now() WHERE id=$1", [p.orderId, next]);
				await audit(client, p.orderId, admin.email, "payment.recorded", { cents, full, currency: p.currency });
				await client.query("COMMIT");
				payment = (await pool.query("SELECT * FROM bank_payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1", [p.orderId])).rows[0];
			} catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
			return NextResponse.json({ payment }, { status: 201 });
		}
		if (action === "credit") {
			const parsed = markSchema.safeParse(await req.json().catch(() => null));
			if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
			const client = await (pool as any).connect();
			try {
				await client.query("BEGIN");
				const locked = await client.query("SELECT * FROM bank_orders WHERE id=$1 FOR UPDATE", [parsed.data.orderId]);
				const order = locked.rows[0];
				if (!order) throw Object.assign(new Error("Order not found."), { status: 404 });
				if (order.status === "credited") throw Object.assign(new Error("Order is already credited."), { status: 409 });
				const paid = await client.query("SELECT COALESCE(SUM(amount_cents),0)::int AS paid,CASE WHEN COUNT(*) FILTER (WHERE currency<>'EUR')>0 THEN true ELSE false END AS nonEur FROM bank_payments WHERE order_id=$1", [parsed.data.orderId]);
				const paidCents = Number(paid.rows[0].paid);
				if (paid.rows[0].nonEur || paidCents < Number(order.eur_amount) * 100)
					throw Object.assign(new Error("Full EUR receipt is required before crediting."), { status: 409 });
				const account = await client.query("SELECT id FROM users WHERE id=$1", [order.user_id]);
				if (!account.rowCount) throw new Error("Buyer account is missing.");
				await grantTokens(client, order.user_id, Number(order.tokens), `Bank transfer ${order.public_number}`);
				await client.query("INSERT INTO token_transactions (id,user_id,amount,reason) VALUES ($1,$2,$3,$4)", [randomUUID(), order.user_id, Number(order.tokens), `Bank transfer ${order.public_number}`]);
				await client.query("UPDATE bank_orders SET status='credited',updated_at=now() WHERE id=$1", [parsed.data.orderId]);
				const year = new Date().getUTCFullYear();
				const receiptNo = `PAY-${year}-${order.public_number.slice(-6)}`;
				await client.query("INSERT INTO bank_order_documents (id,order_id,kind,doc_number,payload) VALUES ($1,$2,'receipt',$3,$4) ON CONFLICT (doc_number) DO NOTHING", [randomUUID(), parsed.data.orderId, receiptNo, JSON.stringify({ paidCents, by: admin.email })]);
				await audit(client, parsed.data.orderId, admin.email, "order.credited", { tokens: Number(order.tokens), note: parsed.data.note });
				await client.query("COMMIT");
				try {
					const result = await sendPlainMail(order.email, `Tokens credited for order ${order.public_number}`, `Order ${order.public_number} is paid. ${Number(order.tokens).toLocaleString("en-US")} tokens were credited to your Velora account.`);
					await pool.query("INSERT INTO bank_mail_log (order_id,to_email,subject,body,message_id,state,error) VALUES ($1,$2,$3,$4,$5,$6,'') ON CONFLICT (order_id) DO UPDATE SET subject=$3,body=$4,message_id=$5,state=$6,sent_at=now()", [parsed.data.orderId, order.email, `Tokens credited for order ${order.public_number}`, `Order ${order.public_number} is paid.`, result.sent ? result.messageId : "", result.sent ? "sent-credit" : "logged-no-smtp"]);
				} catch (e) { await audit(pool, parsed.data.orderId, admin.email, "mail.failed", { error: (e as Error).message.slice(0, 300) }); }
				return NextResponse.json({ credited: true });
			} catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
		}
		if (action === "mark") {
			const parsed = z.object({ orderId: z.string().uuid(), status: z.enum(["review", "reported", "cancelled"]), note: z.string().max(2000).default("") }).safeParse(await req.json().catch(() => null));
			if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
			const current = (await pool.query("SELECT status FROM bank_orders WHERE id=$1", [parsed.data.orderId])).rows[0];
			if (!current) return NextResponse.json({ error: "Order not found." }, { status: 404 });
			if (["credited", "refunded"].includes(current.status)) return NextResponse.json({ error: `Order is ${current.status}.` }, { status: 409 });
			await pool.query("UPDATE bank_orders SET status=$2,updated_at=now() WHERE id=$1", [parsed.data.orderId, parsed.data.status]);
			await audit(pool, parsed.data.orderId, admin.email, `order.${parsed.data.status}`, { note: parsed.data.note });
			return NextResponse.json({ status: parsed.data.status });
		}
		if (action === "refund") {
			const parsed = refundSchema.safeParse(await req.json().catch(() => null));
			if (!parsed.success) return NextResponse.json({ error: "Complete refund amount, reason and status." }, { status: 400 });
			const client = await (pool as any).connect();
			try {
				await client.query("BEGIN");
				const locked = await client.query("SELECT * FROM bank_orders WHERE id=$1 FOR UPDATE", [parsed.data.orderId]);
				if (!locked.rows[0]) throw Object.assign(new Error("Order not found."), { status: 404 });
				await client.query("INSERT INTO bank_refunds (id,order_id,amount_cents,status,reason,bank_ref,decided_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), parsed.data.orderId, eurToCents(parsed.data.amount), parsed.data.status, parsed.data.reason, parsed.data.bankRef, admin.email]);
				if (parsed.data.status === "executed") {
					if (parsed.data.tokenCorrection > 0)
						await client.query("INSERT INTO token_transactions (id,user_id,amount,reason) VALUES ($1,$2,$3,$4)", [randomUUID(), locked.rows[0].user_id, -parsed.data.tokenCorrection, `Refund correction for ${locked.rows[0].public_number}`]);
					await client.query("UPDATE bank_orders SET status='refunded',updated_at=now() WHERE id=$1", [parsed.data.orderId]);
				}
				await audit(client, parsed.data.orderId, admin.email, `refund.${parsed.data.status}`, { amount: parsed.data.amount });
				await client.query("COMMIT");
				return NextResponse.json({ recorded: true });
			} catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
		}
		if (action === "contract") {
			const body = await req.json().catch(() => null) as { orderId?: string; fileName?: string; mime?: string; dataBase64?: string } | null;
			if (!body?.orderId || !body.fileName || !body.mime || !body.dataBase64) return NextResponse.json({ error: "Attach the signed contract file." }, { status: 400 });
			const buf = Buffer.from(body.dataBase64, "base64");
			if (buf.length === 0 || buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: "File must be 1 byte to 15 MB." }, { status: 400 });
			const dir = join(cfg.evidenceDir, body.orderId);
			await mkdir(dir, { recursive: true });
			const safe = body.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
			const stored = `contract-${safe}`;
			await writeFile(join(dir, stored), buf);
			await pool.query("INSERT INTO bank_evidence (id,order_id,file_name,mime,size_bytes,sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), body.orderId, stored, body.mime.slice(0, 120), buf.length, createHash("sha256").update(buf).digest("hex"), admin.email]);
			await audit(pool, body.orderId, admin.email, "contract.attached", { file: safe });
			return NextResponse.json({ attached: true });
		}
		if (action === "dossier") {
			const orderId = req.nextUrl.searchParams.get("orderId") ?? (await req.json().catch(() => null) as { orderId?: string } | null)?.orderId;
			if (!orderId || !z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
			const dossier = await buildOrderDossier(pool, orderId, cfg.evidenceDir);
			if (!dossier) return NextResponse.json({ error: "Order not found." }, { status: 404 });
			await audit(pool, orderId, admin.email, "dossier.downloaded", { files: dossier.fileCount });
			return new NextResponse(new Uint8Array(dossier.zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="dossier-${dossier.publicNumber}.zip"` } });
		}
		return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
	} catch (e) { return failure(e); }
}
