// Invoice orders: users place an order, an administrator invoices and credits tokens.
// Admin access is granted by email allowlist via ADMIN_EMAILS (comma-separated).
import { user } from "./auth";

export function adminEmails(): string[] {
	return (process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((v) => v.toLowerCase().trim())
		.filter(Boolean);
}

export async function adminUser() {
	const account = await user();
	if (!account) return null;
	if (!adminEmails().includes(account.email.toLowerCase())) return null;
	return account;
}
