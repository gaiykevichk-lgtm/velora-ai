import { type NextRequest, NextResponse } from "next/server";
import { bankConfig } from "@/lib/bank-transfer";
import { failure } from "@/lib/api";

export const runtime = "nodejs";
// Public purchase terms: no auth, no secrets — only display values.
export async function GET(_req: NextRequest) {
	try {
		const validityMonths = Number(process.env.BANK_TOKEN_VALIDITY_MONTHS ?? "12") || 12;
		const enabled = process.env.BANK_TRANSFER_ENABLED === "true";
		let seller: Record<string, string> = { legalName: "", bank: "", country: "", address: "", ibanTail: "", bicTail: "" };
		let configured = false;
		try {
			const cfg = bankConfig();
			seller = { legalName: cfg.seller.legalName, bank: cfg.seller.bank, country: cfg.seller.country, address: cfg.seller.address, ibanTail: cfg.seller.iban.slice(-4), bicTail: cfg.seller.bic.slice(-3) };
			configured = true;
			return NextResponse.json({ enabled, configured, minEur: 1, maxEur: 2500, tokensPerEur: 100, validityMonths: cfg.validityMonths, creditDays: cfg.creditDays, termsVersion: cfg.termsVersion, seller }, { headers: { "Cache-Control": "no-store" } });
		} catch {
			return NextResponse.json({ enabled, configured, minEur: 1, maxEur: 2500, tokensPerEur: 100, validityMonths, creditDays: Number(process.env.BANK_CREDIT_DAYS_AFTER_RECEIPT ?? "2") || 2, termsVersion: process.env.BANK_TERMS_VERSION?.trim() || "2026-10-26-v1", seller }, { headers: { "Cache-Control": "no-store" } });
		}
	} catch (e) { return failure(e); }
}
