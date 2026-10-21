import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { adminUser } from "@/lib/admin";
import { dbAsync } from "@/lib/db";
import { failure } from "@/lib/api";
import { audit, bankConfig, sha256Hex } from "@/lib/bank-transfer";

export const runtime = "nodejs";
const ALLOWED = new Set(["application/pdf", "text/csv", "image/png", "image/jpeg"]);
export async function POST(req: NextRequest) {
	try {
		const cfg = bankConfig();
		const admin = await adminUser();
		if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
		const form = await req.formData();
		const orderId = String(form.get("orderId") ?? "");
		const file = form.get("file");
		if (!/^[0-9a-f-]{36}$/.test(orderId) || !(file instanceof File))
			return NextResponse.json({ error: "Select an order and a file." }, { status: 400 });
		if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only PDF, CSV, PNG or JPEG evidence is accepted." }, { status: 400 });
		if (file.size === 0 || file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File must be 1 byte to 15 MB." }, { status: 400 });
		const buf = Buffer.from(await file.arrayBuffer());
		const dir = join(cfg.evidenceDir, orderId);
		await mkdir(dir, { recursive: true });
		const base = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "evidence";
		const stored = `${Date.now()}-${base}`;
		await writeFile(join(dir, stored), buf);
		const pool = await dbAsync();
		await pool.query("INSERT INTO bank_evidence (id,order_id,file_name,mime,size_bytes,sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), orderId, stored, file.type, buf.length, sha256Hex(buf), admin.email]);
		await audit(pool, orderId, admin.email, "evidence.attached", { file: stored, bytes: buf.length });
		return NextResponse.json({ attached: true });
	} catch (e) { return failure(e); }
}
