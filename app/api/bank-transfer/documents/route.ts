import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { bankConfig, textPdf } from "@/lib/bank-transfer";

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
			const pdf = textPdf(`${row.kind} ${row.doc_number}`, [
				`${row.kind}: ${row.doc_number} (${new Date().toISOString().slice(0, 10)})`,
				`Seller: ${(row.seller as any).legalName}, ${(row.seller as any).address}`,
				`Buyer: ${row.buyer.kind === "company" ? `${b.legalName}, ${b.regNumber}` : b.fullName}, ${b.country}`,
				`Order ${row.public_number}: ${Number(row.tokens).toLocaleString("en-US")} tokens, ${row.eur_amount} EUR. Terms ${row.terms_version}.`,
			]);
			return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${row.kind}-${row.doc_number}.pdf"` } });
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
