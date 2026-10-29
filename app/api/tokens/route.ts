import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";

import { TOKEN_PACKAGES } from "@/lib/commerce";
import { reservedTokens, syncTokenBalance } from "@/lib/tokens";

export async function GET() {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const pool = await dbAsync();
		// Expired lots are dropped here, so the balance always matches the
		// published 12-month validity.
		const balance = await syncTokenBalance(pool, account.id);
		const txsRes = await pool.query(
			"SELECT id, amount, reason, created_at FROM token_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
			[account.id],
		);
		return NextResponse.json({
			tokens: balance.tokens,
			reserved: await reservedTokens(pool, account.id),
			tokensExpireAt: balance.expiresAt,
			rates: { text: 5, image: 25, video: 100 },
			packages: TOKEN_PACKAGES,
			currency: "EUR",
			validityMonths: 12,
			operationRatesVerified: true,
			expiryTrackingEnabled: true,
			topupEnabled: false,
			purchaseMethod: "bank-transfer-or-card",
			purchaseNote: "Buy in Studio: card checkout through Infini is credited automatically after the payment is verified; bank transfers are credited after Omnix21 confirms the receipt.",
			transactions: txsRes.rows,
		});
	} catch (e) {
		return failure(e);
	}
}

// Fail closed until verified payment processing is implemented.
// Never trust a package selection or a claimed payment from the browser.
export async function POST() {
	try {
		const account = await user();
		if (!account) return unauthorized();
		return NextResponse.json(
			{
				code: "TOPUP_DISABLED",
				error:
					"Online token purchases are not connected yet. No payment has been taken and no tokens have been credited.",
			},
			{ status: 403 },
		);
	} catch (e) {
		return failure(e);
	}
}
