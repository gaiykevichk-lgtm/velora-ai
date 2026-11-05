import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, originAllowed, unauthorized } from "@/lib/api";
import {
	CARD_MAX_EUR,
	CARD_MIN_EUR,
	TOKEN_PACKAGES,
	TOKENS_PER_EUR,
} from "@/lib/commerce";
import { ConfigurationError } from "@/lib/configuration";
import { paymentConfig, type PaymentOrder } from "@/lib/payments";
import { infiniRequest, trustedCheckoutUrl } from "@/lib/infini.mjs";

export const runtime = "nodejs";
const schema = z
	.object({
		packageId: z.enum(["starter", "professional"]).optional(),
		eurAmount: z.number().int().min(CARD_MIN_EUR).max(CARD_MAX_EUR).optional(),
		requestId: z.string().uuid(),
        buyerName: z.string().trim().min(2).max(200),
	})
	.refine((v) => (v.packageId === undefined) !== (v.eurAmount === undefined));
export async function POST(req: NextRequest) {
	let stage = "start";
	try {
		stage = "config";
		const config = paymentConfig();
		if (!originAllowed(req, config.appOrigin))
			return NextResponse.json(
				{ error: "Invalid request origin." },
				{ status: 403 },
			);
		const account = await user();
		if (!account) return unauthorized();
		const parsed = schema.safeParse(await req.json().catch(() => null));
		if (!parsed.success)
			return NextResponse.json(
				{ error: `Choose an amount between €${CARD_MIN_EUR} and €${CARD_MAX_EUR.toLocaleString("en-US")}.` },
				{ status: 400 },
			);
		stage = "order";
		const { requestId } = parsed.data;
		const pack = parsed.data.packageId
			? TOKEN_PACKAGES[parsed.data.packageId]
			: {
					priceEur: parsed.data.eurAmount as number,
					tokens: (parsed.data.eurAmount as number) * TOKENS_PER_EUR,
				};
		const packageId = parsed.data.packageId ?? "custom";
		const pool = await dbAsync();
		// Limit only new orders. Network retries must reuse their existing UUID.
		const exists = await pool.query(
			"SELECT id FROM payment_orders WHERE id=$1",
			[requestId],
		);
		if (!exists.rowCount) {
			const recent = await pool.query(
				"SELECT count(*)::int AS count FROM payment_orders WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
				[account.id],
			);
			if (recent.rows[0].count >= 10)
				return NextResponse.json(
					{ error: "Too many payment attempts. Try again later." },
					{ status: 429 },
				);
		}
		await pool.query(
			"INSERT INTO payment_orders (id,user_id,email,package_id,eur_amount,tokens,buyer_name) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
			[
				requestId,
				account.id,
				account.email,
				packageId,
				pack.priceEur,
				pack.tokens,
                parsed.data.buyerName,
			],
		);
		const { rows } = await pool.query(
			"SELECT * FROM payment_orders WHERE id=$1 AND user_id=$2",
			[requestId, account.id],
		);
		const order = rows[0] as PaymentOrder | undefined;
		if (
			!order ||
			order.package_id !== packageId ||
			Number(order.eur_amount) !== pack.priceEur
		)
			return NextResponse.json(
				{ error: "Order ID is already in use." },
				{ status: 409 },
			);
		if (order.status === "credited")
			return NextResponse.json(
				{ error: "This order is already paid." },
				{ status: 409 },
			);
		if (order.checkout_url)
			return NextResponse.json({
				checkoutUrl: trustedCheckoutUrl(
					order.checkout_url,
					config.checkoutOrigin,
				),
				orderId: order.id,
			});
		let remote: any;
		try {
		remote = await infiniRequest(config, "POST", "/v1/acquiring/order", {
			request_id: order.id,
			client_reference: order.id,
			amount: String(order.eur_amount),
			currency: "EUR",
			email: order.email,
			order_desc: `Velora AI — ${order.tokens} prepaid tokens`,
			success_url: `${config.appOrigin}/studio?topup=open&paymentOrder=${order.id}`,
			failure_url: `${config.appOrigin}/studio?topup=open&paymentOrder=${order.id}`,
			// Omit pay_methods: only merchant-approved configured methods are offered.
		});
		} catch (providerError) {
			console.error("[payments] checkout creation failed", { orderId: order.id, error: (providerError as Error).message });
			// The provider already knows this request_id but we never stored its
			// checkout link (older failed attempt): retire it so a new order is made.
			if ((providerError as { providerCode?: number }).providerCode === 40901) {
				await pool.query(
					"UPDATE payment_orders SET status='expired',updated_at=now() WHERE id=$1 AND checkout_url IS NULL AND status IN ('creating','pending')",
					[order.id],
				);
				return NextResponse.json(
					{ error: "Please try again to open a fresh payment page.", code: "STALE_ORDER" },
					{ status: 409 },
				);
			}
			return NextResponse.json(
				{ error: "The payment page could not be opened right now. You were not charged. Please try again in a few minutes or use bank transfer.", code: "CHECKOUT_PROVIDER" },
				{ status: 502 },
			);
		}
		stage = "provider-response";
		const checks = {
			orderIdIsString: typeof remote?.order_id === "string" && Boolean(remote.order_id),
			requestIdMatches: remote?.request_id === order.id,
			clientReferenceMatches: remote?.client_reference === order.id,
			hasCheckoutUrl: typeof remote?.checkout_url === "string",
		};
		if (!checks.orderIdIsString || !checks.hasCheckoutUrl) {
			console.error("[payments] unexpected provider response", { providerCode: remote?.code, providerMessage: String(remote?.message ?? "").slice(0, 200), keys: Object.keys(remote ?? {}), checks });
			return NextResponse.json(
				{ error: "The payment page could not be opened right now. You were not charged. Please try again in a few minutes or use bank transfer.", code: "CHECKOUT_PROVIDER-RESPONSE", diagnostics: { providerCode: remote?.code ?? null, providerMessage: typeof remote?.message === "string" ? remote.message.slice(0, 200) : null, keys: Object.keys(remote ?? {}), dataKeys: Object.keys(remote?.data ?? {}), checks } },
				{ status: 502 },
			);
		}
		if (!checks.requestIdMatches && !checks.clientReferenceMatches)
			throw new Error(`Provider reference mismatch: ${JSON.stringify(checks)}`);
		stage = "checkout-url";
		const checkoutUrl = trustedCheckoutUrl(
			remote.checkout_url,
			config.checkoutOrigin,
		);
		stage = "save";
		// A concurrent webhook may already have credited it; never regress status.
		await pool.query(
			"UPDATE payment_orders SET provider_order_id=$2,checkout_url=$3,status=CASE WHEN status='creating' THEN 'pending' ELSE status END,updated_at=now() WHERE id=$1",
			[order.id, remote.order_id, checkoutUrl],
		);
		return NextResponse.json({ checkoutUrl, orderId: order.id });
	} catch (error) {
		console.error("[payments] checkout failed at stage", stage, (error as Error).message);
		if (error instanceof ConfigurationError) return failure(error);
		return NextResponse.json(
			{ error: "The payment page could not be opened right now. You were not charged. Please try again in a few minutes or use bank transfer.", code: `CHECKOUT_${stage.toUpperCase()}` },
			{ status: 502 },
		);
	}
}
