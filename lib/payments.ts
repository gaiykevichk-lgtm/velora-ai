import { dbAsync } from "./db";
import { ConfigurationError } from "./configuration";
import {
	confirmedOrderMatches,
	infiniRequest,
	creditVerifiedOrder,
} from "./infini.mjs";

// Names (never values) of settings that stop online payments from working.
export function missingPaymentSettings() {
	const missing = [
		"DATABASE_URL",
		"INFINI_KEY_ID",
		"INFINI_SECRET_KEY",
		"INFINI_WEBHOOK_SECRET",
		"APP_BASE_URL",
	].filter((name) => !process.env[name]);
	if (process.env.INFINI_ENABLED !== "true") missing.unshift("INFINI_ENABLED");
	return missing;
}

export function paymentConfig() {
	const missing = missingPaymentSettings();
	if (missing.length) {
		console.error("[payments] not configured, missing:", missing.join(", "));
	}
	if (missing.length)
		throw new ConfigurationError(
			"Online payments are not configured yet. No payment has been taken.",
		);
	const app = new URL(process.env.APP_BASE_URL as string);
	const api = new URL(
		process.env.INFINI_API_BASE_URL || "https://openapi.infini.money",
	);
	const checkout = new URL(
		process.env.INFINI_CHECKOUT_ORIGIN || "https://checkout.infini.money",
	);
	if (
		[app, api, checkout].some(
			(u) =>
				u.protocol !== "https:" ||
				u.username ||
				u.password ||
				u.pathname !== "/" ||
				u.search ||
				u.hash,
		)
	)
		throw new ConfigurationError("Payment URLs must be HTTPS origins.");
	return {
		appOrigin: app.origin,
		apiBase: api.origin,
		checkoutOrigin: checkout.origin,
		keyId: process.env.INFINI_KEY_ID as string,
		secret: process.env.INFINI_SECRET_KEY as string,
		webhookSecret: process.env.INFINI_WEBHOOK_SECRET as string,
	};
}
export function paymentsEnabled() {
	try {
		paymentConfig();
		return true;
	} catch {
		return false;
	}
}
export type PaymentOrder = {
	id: string;
	user_id: string;
	provider_order_id: string | null;
	eur_amount: number;
	tokens: number;
	status: string;
	package_id: string;
	email: string;
	checkout_url: string | null;
};

// Dedicated connection: BEGIN/COMMIT must never be sent through pool.query.
export async function settlePayment(
	orderId: string,
	config: ReturnType<typeof paymentConfig>,
	event?: { id: string; kind: string; rawHash: string },
) {
	const pool = await dbAsync();
	const result = await pool.query("SELECT * FROM payment_orders WHERE id=$1", [
		orderId,
	]);
	const local = result.rows[0] as PaymentOrder | undefined;
	if (!local?.provider_order_id)
		throw new Error("Payment order is not ready for reconciliation.");
	const remote = await infiniRequest(
		config,
		"GET",
		`/v1/acquiring/order?order_id=${encodeURIComponent(local.provider_order_id)}`,
	);
	const paid = confirmedOrderMatches(remote, local);
	if (
		remote.order_id !== local.provider_order_id ||
		remote.client_reference !== local.id
	)
		throw new Error("Payment reference mismatch.");
	if (!("connect" in pool))
		throw new ConfigurationError("Payments require persistent PostgreSQL.");
	await creditVerifiedOrder(pool, local, paid, remote.status, event);
}
