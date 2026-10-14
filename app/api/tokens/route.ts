import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";

import { TOKEN_PACKAGES } from "@/lib/commerce";

export async function GET() {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const pool = await dbAsync();
		const balanceRes = await pool.query<{ tokens: number }>(
			"SELECT tokens FROM users WHERE id=$1",
			[account.id],
		);
		const txsRes = await pool.query(
			"SELECT id, amount, reason, created_at FROM token_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
			[account.id],
		);
		return NextResponse.json({
			tokens: balanceRes.rows[0]?.tokens ?? 0,
			rates: { text: 5, image: 25, video: 100 },
			packages: TOKEN_PACKAGES,
            currency: "EUR",
            validityMonths: 12,
            operationRatesVerified: false,
            expiryTrackingEnabled: false,
			topupEnabled: false,
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
