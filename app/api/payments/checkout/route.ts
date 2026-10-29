import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, originAllowed, unauthorized } from "@/lib/api";
import { TOKEN_PACKAGES } from "@/lib/commerce";
import { ConfigurationError } from "@/lib/configuration";
import { paymentConfig, type PaymentOrder } from "@/lib/payments";
import { infiniRequest, trustedCheckoutUrl } from "@/lib/infini.mjs";

export const runtime = "nodejs";
const schema = z.object({
	packageId: z.enum(["starter", "professional"]),
	requestId: z.string().uuid(),
});
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
				{ error: "Choose a valid package and request ID." },
				{ status: 400 },
			);
		stage = "order";
		const { packageId, requestId } = parsed.data;
		const pack = TOKEN_PACKAGES[packageId];
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
			"INSERT INTO payment_orders (id,user_id,email,package_id,eur_amount,tokens) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
			[
				requestId,
				account.id,
				account.email,
				packageId,
				pack.priceEur,
				pack.tokens,
			],
		);
		const { rows } = await pool.query(
			"SELECT * FROM payment_orders WHERE id=$1 AND user_id=$2",
			[requestId, account.id],
		);
		const order = rows[0] as PaymentOrder | undefined;
		if (!order || order.package_id !== packageId)
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
			return NextResponse.json(
				{ error: "The payment page could not be opened right now. You were not charged. Please try again in a few minutes or use bank transfer.", code: "CHECKOUT_PROVIDER" },
				{ status: 502 },
			);
		}
		stage = "provider-response";
		if (
			typeof remote?.order_id !== "string" ||
			!remote.order_id ||
			remote.request_id !== order.id ||
			remote.client_reference !== order.id
		)
			throw new Error(`Invalid payment provider reference; response keys: ${Object.keys(remote ?? {}).join(",")}`);
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
