import { dbAsync } from "./db";
// The existing bank_seq is shared by new card invoices. Once allocated, numbers
// are stored on the order; downloads and email retries never allocate again.
export async function cardInvoice(orderId: string) {
	const pool = await dbAsync();
	if (!("connect" in pool))
		throw new Error("Invoice allocation requires PostgreSQL.");
	const c = await (pool as any).connect();
	try {
		await c.query("BEGIN");
		const o = (
			await c.query("SELECT * FROM payment_orders WHERE id=$1 FOR UPDATE", [
				orderId,
			])
		).rows[0];
		if (!o || o.status !== "credited")
			throw new Error("Credited order is required.");
		if (!o.invoice_number) {
			const date = new Date(o.paid_at);
			const year = date.getUTCFullYear();
			const seq = await c.query(
				"INSERT INTO bank_seq (year,last_no) VALUES ($1,1) ON CONFLICT (year) DO UPDATE SET last_no=bank_seq.last_no+1 RETURNING last_no",
				[year],
			);
			o.invoice_number = `TU-${year}-${String(seq.rows[0].last_no).padStart(6, "0")}`;
			await c.query("UPDATE payment_orders SET invoice_number=$2 WHERE id=$1", [
				orderId,
				o.invoice_number,
			]);
		}
		await c.query("COMMIT");
		return o;
	} catch (e) {
		await c.query("ROLLBACK");
		throw e;
	} finally {
		c.release();
	}
}
