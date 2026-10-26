import { type NextRequest, NextResponse } from "next/server";
import { BANK_MAX_EUR, BANK_MIN_EUR, bankConfig } from "@/lib/bank-transfer";
import { failure } from "@/lib/api";

export const runtime = "nodejs";
// Public purchase terms: no auth, no secrets — only display values.
export async function GET(_req: NextRequest) {
	try {
		const enabled = process.env.BANK_TRANSFER_ENABLED === "true";
		// Shared defaults so a missing optional variable never changes the
		// commercial conditions advertised on the site.
		let validityMonths = 12;
		let creditDays = 2;
		let termsVersion = "2026-10-26-v1";
		let seller: Record<string, string> = {
			legalName: "",
			bank: "",
			country: "",
			address: "",
			ibanTail: "",
			bicTail: "",
		};
		let configured = false;
		try {
			const cfg = bankConfig();
			validityMonths = cfg.validityMonths;
			creditDays = cfg.creditDays;
			termsVersion = cfg.termsVersion;
			seller = {
				legalName: cfg.seller.legalName,
				bank: cfg.seller.bank,
				country: cfg.seller.country,
				address: cfg.seller.address,
				ibanTail: cfg.seller.iban.slice(-4),
				bicTail: cfg.seller.bic.slice(-3),
			};
			configured = true;
		} catch {
			// Buyer-facing limits stay available even when the bank details are
			// not configured, so the site never shows a broken purchase panel.
			validityMonths =
				Number(process.env.BANK_TOKEN_VALIDITY_MONTHS ?? "12") || 12;
			creditDays =
				Number(process.env.BANK_CREDIT_DAYS_AFTER_RECEIPT ?? "2") || 2;
			termsVersion = process.env.BANK_TERMS_VERSION?.trim() || "2026-10-26-v1";
		}
		return NextResponse.json(
			{
				enabled,
				configured,
				minEur: BANK_MIN_EUR,
				maxEur: BANK_MAX_EUR,
				tokensPerEur: 100,
				validityMonths,
				creditDays,
				termsVersion,
				seller,
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (e) {
		return failure(e);
	}
}
