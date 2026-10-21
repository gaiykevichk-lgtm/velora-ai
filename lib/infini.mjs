import {
	createHash,
	createHmac,
	timingSafeEqual,
	randomUUID,
} from "node:crypto";

export function signRequest(
	keyId,
	secret,
	method,
	path,
	body,
	date = new Date().toUTCString(),
) {
	const signature = createHmac("sha256", secret)
		.update(`${keyId}\n${method.toUpperCase()} ${path}\ndate: ${date}\n`)
		.digest("base64");
	return {
		Date: date,
		Authorization: `Signature keyId="${keyId}",algorithm="hmac-sha256",headers="@request-target date",signature="${signature}"`,
		...(body === undefined
			? {}
			: {
					Digest: `SHA-256=${createHash("sha256").update(body).digest("base64")}`,
					"Content-Type": "application/json",
				}),
	};
}

export function verifyWebhook(raw, headers, secret, now = Date.now()) {
	const timestamp = headers.get("x-webhook-timestamp") || "";
	const eventId = headers.get("x-webhook-event-id") || "";
	const signature = headers.get("x-webhook-signature") || "";
	const version = headers.get("x-webhook-signature-version");
	// Covers documented automatic retry window, rejects stale/replayed deliveries.
	if (
		!/^\d{10}$/.test(timestamp) ||
		Math.abs(now / 1000 - Number(timestamp)) > 3600 ||
		!eventId ||
		eventId.length > 200 ||
		!/^[a-fA-F0-9]{64}$/.test(signature) ||
		(version && version !== "v1")
	)
		return false;
	const expected = createHmac("sha256", secret)
		.update(`${timestamp}.${eventId}.`)
		.update(raw)
		.digest();
	return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function trustedCheckoutUrl(value, origin) {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.origin !== origin ||
		url.username ||
		url.password
	)
		throw new Error("Invalid checkout URL from payment provider.");
	return url.toString();
}

export function confirmedOrderMatches(remote, local) {
	// EUR packages have integer amounts; parse without floating-point rounding.
	const amount = String(remote.amount);
	return (
		remote.order_id === local.provider_order_id &&
		remote.client_reference === local.id &&
		remote.status === "paid" &&
		remote.currency === "EUR" &&
		/^\d+(?:\.0{1,6})?$/.test(amount) &&
		Number(amount) === local.eur_amount &&
		(!remote.exception_tags ||
			(Array.isArray(remote.exception_tags) &&
				remote.exception_tags.length === 0))
	);
}

export async function infiniRequest(
	config,
	method,
	path,
	payload,
	fetcher = fetch,
) {
	const body = payload === undefined ? undefined : JSON.stringify(payload);
	const response = await fetcher(`${config.apiBase}${path}`, {
		method,
		headers: signRequest(config.keyId, config.secret, method, path, body),
		body,
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.timeout(20000),
	});
	// Never propagate provider response bodies (may contain sensitive data) to UI/logs.
	if (!response.ok)
		throw new Error(
			"Payment provider could not process the request. Retry the same order.",
		);
	return response.json();
}

// Pool is injected for isolated tests; production always supplies external pg.Pool.
export async function creditVerifiedOrder(
	pool,
	local,
	paid,
	remoteStatus,
	event,
) {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const locked = await client.query(
			"SELECT status FROM payment_orders WHERE id=$1 FOR UPDATE",
			[local.id],
		);
		if (!locked.rows[0]) throw new Error("Payment order not found.");
		if (event) {
			const seen = await client.query(
				"INSERT INTO payment_events (event_id,order_id,kind,payload_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
				[event.id, local.id, event.kind, event.rawHash],
			);
			if (!seen.rowCount) {
				await client.query("COMMIT");
				return;
			}
		}
		if (locked.rows[0].status !== "credited") {
			if (paid) {
				const balance = await client.query(
					"UPDATE users SET tokens=tokens+$1 WHERE id=$2",
					[local.tokens, local.user_id],
				);
				if (balance.rowCount !== 1)
					throw new Error("Payment account not found.");
				await client.query(
					"INSERT INTO token_transactions (id,user_id,amount,reason) VALUES ($1,$2,$3,$4)",
					[
						randomUUID(),
						local.user_id,
						local.tokens,
						`Infini payment ${local.id}`,
					],
				);
				await client.query(
					"UPDATE payment_orders SET status='credited',paid_at=now(),expires_at=now()+interval '12 months',updated_at=now() WHERE id=$1",
					[local.id],
				);
			} else {
				const status =
					remoteStatus === "paid"
						? "review"
						: ["pending", "processing", "partial_paid", "expired"].includes(
									remoteStatus,
								)
							? remoteStatus
							: "review";
				await client.query(
					"UPDATE payment_orders SET status=$2,updated_at=now() WHERE id=$1",
					[local.id, status],
				);
			}
		}
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
