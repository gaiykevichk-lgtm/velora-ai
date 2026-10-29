import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { bankConfig, textPdf } from "@/lib/bank-transfer";
import { COMPANY } from "@/lib/company";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
	try {
		const cfg = bankConfig();
		const account = await user();
		if (!account) return unauthorized();
		const kind = req.nextUrl.searchParams.get("kind");
		const doc = req.nextUrl.searchParams.get("doc");
		const evidenceId = req.nextUrl.searchParams.get("evidenceId");
		const pool = await dbAsync();
		if (kind === "document" && doc) {
			const row = (await pool.query(
				"SELECT d.kind,d.doc_number,d.payload,o.user_id,o.public_number,o.eur_amount,o.tokens,o.buyer,o.seller,o.confirmed_at,o.terms_version FROM bank_order_documents d JOIN bank_orders o ON o.id=d.order_id WHERE d.id=$1",
				[doc],
			)).rows[0];
			if (!row) return NextResponse.json({ error: "Document not found." }, { status: 404 });
			const admin = await adminUser();
			if (!admin && row.user_id !== account.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
			const b = row.buyer as Record<string, string>;
			const sl = row.seller as Record<string, string>;
			const buyerName = row.buyer.kind === "company" ? `${b.legalName}, reg. ${b.regNumber}` : b.fullName;
			const pdf = textPdf(`${row.kind} ${row.doc_number}`, [
				`${String(row.kind).toUpperCase()} ${row.doc_number}`,
				`Date: ${new Date(row.confirmed_at).toISOString().slice(0, 10)}   Order: ${row.public_number}`,
				`Seller: ${sl.legalName}, ${sl.address}`,
				`Seller registration: ${COMPANY.registration}`,
				`Buyer: ${buyerName}, ${b.country}`,
				`Item: Prepaid Velora AI tokens (usage units for AI generation)`,
				`Quantity: ${Number(row.tokens).toLocaleString("en-US")} tokens   Total: ${Number(row.eur_amount).toFixed(2)} EUR`,
				`Tokens valid 12 months from the credit date. Terms version ${row.terms_version}.`,
				`Tax: price shown is the total payable in EUR; tax details as stated by the seller on this document.`,
				`Payment reference: Invoice ${row.doc_number}`,
				`IBAN ${sl.iban}   BIC ${sl.bic}   Bank ${sl.bank}`,
			]);
			return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${row.kind}-${row.doc_number}.pdf"` } });
		}
		const orderParam = req.nextUrl.searchParams.get("orderId");
		if (kind === "requisites" && orderParam) {
			const o = (await pool.query(
				"SELECT o.public_number,o.eur_amount,o.tokens,o.seller,o.buyer,o.user_id FROM bank_orders o WHERE o.id=$1",
				[orderParam],
			)).rows[0];
			if (!o) return NextResponse.json({ error: "Order not found." }, { status: 404 });
			const admin = await adminUser();
			if (!admin && o.user_id !== account.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
			const sl = o.seller as Record<string, string>;
			const invRow = (await pool.query("SELECT doc_number FROM bank_order_documents WHERE order_id=$1 AND kind='invoice' ORDER BY created_at LIMIT 1", [orderParam])).rows[0];
			const inv = invRow?.doc_number ?? o.public_number;
			const pdf = textPdf(`Payment details ${o.public_number}`, [
				`Payment details for order ${o.public_number}`,
				`Recipient: ${sl.legalName}`,
				`IBAN: ${sl.iban}`,
				`BIC: ${sl.bic}   Bank: ${sl.bank}`,
				`Bank address: ${sl.address}`,
				`Amount: ${Number(o.eur_amount).toFixed(2)} EUR (${Number(o.tokens).toLocaleString("en-US")} tokens)`,
				`Payment reference: Invoice ${inv}`,
				`Transfer the exact amount; tokens are credited after the receipt is confirmed.`,
			]);
			return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="payment-details-${o.public_number}.pdf"` } });
		}
		if (kind === "refund" && doc) {
			const admin = await adminUser();
			if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
			const r = (await pool.query("SELECT r.*,o.public_number FROM bank_refunds r JOIN bank_orders o ON o.id=r.order_id WHERE r.id=$1", [doc])).rows[0];
			if (!r) return NextResponse.json({ error: "Refund not found." }, { status: 404 });
			const pdf = textPdf(`Refund ${r.id.slice(0, 8)}`, [
				`Refund record for order ${r.public_number}, status ${r.status}.`,
				`Amount: ${Number(r.amount_cents) / 100} EUR, bank ref ${r.bank_ref || "manual"}.`,
				`Reason: ${r.reason}. Decided by ${r.decided_by} at ${r.decided_at}.`,
			]);
			return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="refund-${r.public_number}.pdf"` } });
		}
		if (evidenceId) {
			const row = (await pool.query(
				"SELECT e.*,o.user_id FROM bank_evidence e JOIN bank_orders o ON o.id=e.order_id WHERE e.id=$1",
				[evidenceId],
			)).rows[0];
			if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });
			const admin = await adminUser();
			if (!admin && row.user_id !== account.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
			if (row.uploaded_by === "system")
				return new NextResponse(new Uint8Array(Buffer.from(`Generated confirmation for order file ${row.file_name}. Regenerate from Documents.`)), { headers: { "Content-Type": "text/plain" } });
			const buf = await readFile(join(cfg.evidenceDir, row.order_id, row.file_name).includes("..") ? "/dev/null" : join(cfg.evidenceDir, row.order_id, row.file_name));
			return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": row.mime, "Content-Disposition": `attachment; filename="${row.file_name}"` } });
		}
		if (req.nextUrl.searchParams.get("dossier") === "zip") {
			return NextResponse.json({ error: "Use the dossier PDF endpoint; original bank files download per evidence item." }, { status: 400 });
		}
		return NextResponse.json({ error: "Unknown download." }, { status: 400 });
	} catch (e) { return failure(e); }
}
