import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";

const PACKAGES: Record<
	string,
	{ priceUsd: number; tokens: number; label: string }
> = {
	starter: { priceUsd: 10, tokens: 1000, label: "Starter (1,000 tokens)" },
	creator: { priceUsd: 20, tokens: 2500, label: "Creator (2,500 tokens)" },
	pro: { priceUsd: 50, tokens: 7000, label: "Pro Studio (7,000 tokens)" },
	scale: {
		priceUsd: 100,
		tokens: 15000,
		label: "Scale Agency (15,000 tokens)",
	},
};

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
			packages: PACKAGES,
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
					"Online top-ups are currently unavailable. Token credits must be assigned manually by an administrator.",
			},
			{ status: 403 },
		);
	} catch (e) {
		return failure(e);
	}
}
