import { Pool } from "pg";
import { ConfigurationError } from "./configuration";

type Queryable = {
	query: (...args: any[]) => Promise<any>;
	end?: () => Promise<void>;
};
let pool: Pool | Queryable | undefined;
declare global {
	// eslint-disable-next-line no-var
	var __veloraMemDb: Promise<Queryable> | undefined;
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, tokens int NOT NULL DEFAULT 0, email_verified boolean NOT NULL DEFAULT false, terms_version text, terms_accepted_at timestamptz, marketing_opt_in boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS password_resets (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS email_verifications (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE TABLE IF NOT EXISTS sessions (id_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, mode text NOT NULL CHECK(mode IN ('text','image','video')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS runs (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, mode text NOT NULL CHECK(mode IN ('text','image','video')), prompt text NOT NULL, result text, provider_job_id text, tokens_spent int NOT NULL DEFAULT 0, status text NOT NULL CHECK(status IN ('pending','queued','processing','completed','failed')), error text, aspect_ratio text, duration int, provider_status text, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id, created_at ASC);
CREATE TABLE IF NOT EXISTS token_reservations (id uuid PRIMARY KEY, run_id uuid NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount int NOT NULL CHECK(amount>0), lots jsonb NOT NULL DEFAULT '[]', state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','captured','released')), created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON token_reservations(user_id, state);
CREATE TABLE IF NOT EXISTS run_media (run_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS token_lots (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, tokens int NOT NULL CHECK(tokens>0), remaining int NOT NULL CHECK(remaining>=0), expires_at timestamptz NOT NULL, source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_token_lots_user ON token_lots(user_id, expires_at);
CREATE TABLE IF NOT EXISTS token_transactions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount int NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tokens_user ON token_transactions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS token_orders (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, email text NOT NULL, eur_amount int NOT NULL CHECK(eur_amount BETWEEN 1 AND 10000), tokens int NOT NULL CHECK(tokens>0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','invoiced','credited','cancelled')), admin_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_orders_user ON token_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON token_orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS payment_orders (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), email text NOT NULL, package_id text NOT NULL, eur_amount int NOT NULL CHECK(eur_amount>=16), tokens int NOT NULL CHECK(tokens>0), provider_order_id text UNIQUE, checkout_url text, status text NOT NULL DEFAULT 'creating', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, expires_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS bank_buyers (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, profile jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_seq (year int PRIMARY KEY, last_no int NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bank_orders (id uuid PRIMARY KEY, public_number text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, email text NOT NULL, eur_amount int NOT NULL CONSTRAINT bank_orders_eur_amount_range CHECK(eur_amount BETWEEN 2 AND 2500), tokens int NOT NULL, buyer jsonb NOT NULL, seller jsonb NOT NULL, description text NOT NULL, terms_version text NOT NULL, terms_text text NOT NULL, consent_text text NOT NULL, status text NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','confirmed','partial','review','reported','credited','cancelled','refunded')), confirmed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_bank_orders_user ON bank_orders(user_id, confirmed_at);
CREATE TABLE IF NOT EXISTS bank_order_events (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_payments (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, sender_name text NOT NULL, amount_cents int NOT NULL CHECK(amount_cents>0), currency text NOT NULL DEFAULT 'EUR', received_date date NOT NULL, bank_ref text, payment_ref text, match_basis text, decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id, bank_ref));
CREATE TABLE IF NOT EXISTS bank_refunds (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, amount_cents int NOT NULL CHECK(amount_cents>0), status text NOT NULL DEFAULT 'requested', reason text NOT NULL DEFAULT '', bank_ref text, decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_evidence (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, file_name text NOT NULL, mime text NOT NULL, size_bytes int NOT NULL, sha256 text NOT NULL, uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_mail_log (order_id uuid PRIMARY KEY REFERENCES bank_orders(id) ON DELETE CASCADE, to_email text NOT NULL, subject text NOT NULL, body text NOT NULL, message_id text, state text NOT NULL, error text NOT NULL DEFAULT '', sent_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_order_documents (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('confirmation','invoice','receipt')), doc_number text NOT NULL UNIQUE, version int NOT NULL DEFAULT 1, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_audit_log (id uuid PRIMARY KEY, order_id uuid REFERENCES bank_orders(id) ON DELETE SET NULL, actor_email text NOT NULL, action text NOT NULL, detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_bank_audit_order ON bank_audit_log(order_id, created_at);
CREATE TABLE IF NOT EXISTS payment_events (event_id text PRIMARY KEY, order_id uuid NOT NULL REFERENCES payment_orders(id), kind text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`;

async function memoryDb(): Promise<Queryable> {
	if (!globalThis.__veloraMemDb) {
		globalThis.__veloraMemDb = (async () => {
			const { newDb, DataType } = await import("pg-mem");
			const mem = newDb({ autoCreateForeignKeyIndices: true });
			mem.public.registerFunction({
				name: "now",
				returns: DataType.timestamptz,
				implementation: () => new Date(),
			});
			const { Pool: MemPool } = mem.adapters.createPg();
			const memPool = new MemPool() as Queryable;
			for (const statement of SCHEMA.split(";\n").filter((s) => s.trim())) {
				await memPool.query(statement);
			}
			return memPool;
		})();
	}
	return globalThis.__veloraMemDb;
}

// Inside Render the managed Postgres is reachable on the private network via
// its short resource name (no TLS required). A DATABASE_URL that still points
// at the public `*.frankfurt-postgres.render.com` host also works, but is more
// fragile; when we detect Render runtime, prefer the internal hostname.
export function normalizeConnectionString(raw: string): string {
	const onRender =
		process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
	if (!onRender) return raw;
	return raw.replace(
		/(@)([a-z0-9-]+)\.[a-z0-9-]*postgres\.render\.com(?=[:/])/i,
		"$1$2",
	);
}

export function db(): Pool | Queryable {
	if (!process.env.DATABASE_URL)
		throw new ConfigurationError(
			"DATABASE_URL is not configured yet. Account and saved history require PostgreSQL.",
		);
	if (!pool || !(pool instanceof Pool)) {
		const connectionString = normalizeConnectionString(
			process.env.DATABASE_URL,
		);
		// Render Postgres (external hostnames) requires TLS. Enable it
		// automatically so managed DATABASE_URL values just work; the internal
		// short hostname needs no TLS and is matched by the regex below.
		const needsSsl = /render\.com|[?&]sslmode=require|[?&]ssl=true/i.test(
			connectionString,
		);
		pool = new Pool({
			connectionString,
			max: 5,
			...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
		});
		// Fire-and-forget for sync callers; dbAsync() awaits it properly.
		void ensureSchema(pool as Pool).catch(() => {});
	}
	return pool as Pool;
}

let schemaReady: Promise<void> | undefined;
// Idempotent migrations for databases created before a column/table existed.
const MIGRATIONS = [
	"ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check",
	"ALTER TABLE runs ADD CONSTRAINT runs_status_check CHECK(status IN ('pending','queued','processing','completed','failed'))",
	"ALTER TABLE runs ADD COLUMN IF NOT EXISTS aspect_ratio text",
	"ALTER TABLE runs ADD COLUMN IF NOT EXISTS duration int",
	"ALTER TABLE runs ADD COLUMN IF NOT EXISTS provider_status text",
	"ALTER TABLE runs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()",
	"CREATE TABLE IF NOT EXISTS password_resets (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())",
	"ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text",
	"ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz",
	"ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false",
	"ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false",
	`CREATE TABLE IF NOT EXISTS email_verifications (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
	"CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id)",
	// Commercial limit changed from EUR 1 to EUR 2. NOT VALID keeps historical
	// rows intact while every new order is checked against the new minimum.
	"ALTER TABLE bank_orders DROP CONSTRAINT IF EXISTS bank_orders_eur_amount_check",
	"ALTER TABLE bank_orders ADD CONSTRAINT bank_orders_eur_amount_range CHECK(eur_amount BETWEEN 2 AND 2500) NOT VALID",
];
// Duplicate-object errors mean the migration already ran on this database.
const ALREADY_APPLIED = new Set(["42710", "42701", "42P07"]);
async function ensureSchema(p: Pool): Promise<void> {
	if (!schemaReady) {
		schemaReady = (async () => {
			for (const statement of SCHEMA.split(";\n").filter((s) => s.trim())) {
				await p.query(statement);
			}
			for (const statement of MIGRATIONS) {
				try {
					await p.query(statement);
				} catch (error) {
					const code = (error as { code?: string }).code;
					if (code && ALREADY_APPLIED.has(code)) continue;
					// A later migration must never take the running app down: the
					// base schema is already in place, so record and move on.
					console.error("Migration skipped:", statement.slice(0, 80), code);
				}
			}
		})().catch((e) => {
			schemaReady = undefined;
			throw e;
		});
	}
	return schemaReady;
}

export async function dbAsync(): Promise<Pool | Queryable> {
	// Test-only fallback: in-process PostgreSQL-compatible database (no persistence).
	// Checked first so a full production-like environment (including DATABASE_URL)
	// can still be exercised locally without touching a real database.
	if (process.env.VELORA_TEST_DB === "memory") return memoryDb();
	if (process.env.DATABASE_URL) {
		const p = db() as Pool;
		// CREATE TABLE IF NOT EXISTS — safe to run on every cold start, so a
		// fresh managed database self-initializes without a manual db:setup run.
		await ensureSchema(p);
		return p;
	}
	if (process.env.VELORA_TEST_DB === "memory") return memoryDb();
	throw new ConfigurationError(
		"DATABASE_URL is not configured yet. Account and saved history require PostgreSQL.",
	);
}
