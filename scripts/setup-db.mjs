import pg from "pg";
if (!process.env.DATABASE_URL) {
	console.error("DATABASE_URL is required");
	process.exit(1);
}
const onRender =
	process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
const connectionString = onRender
	? process.env.DATABASE_URL.replace(
			/(@)([a-z0-9-]+)\.[a-z0-9-]*postgres\.render\.com(?=[:/])/i,
			"$1$2",
		)
	: process.env.DATABASE_URL;
const needsSsl = /render\.com|[?&]sslmode=require|[?&]ssl=true/i.test(
	connectionString,
);
const pool = new pg.Pool({
	connectionString,
	...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
try {
	await pool.query(`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, tokens int NOT NULL DEFAULT 0, email_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS email_verifications (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE TABLE IF NOT EXISTS sessions (id_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, mode text NOT NULL CHECK(mode IN ('text','image','video')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS runs (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, mode text NOT NULL CHECK(mode IN ('text','image','video')), prompt text NOT NULL, result text, provider_job_id text, tokens_spent int NOT NULL DEFAULT 0, status text NOT NULL CHECK(status IN ('pending','completed','failed')), error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id, created_at ASC);
CREATE TABLE IF NOT EXISTS token_transactions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount int NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tokens_user ON token_transactions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS token_orders (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, email text NOT NULL, eur_amount int NOT NULL CHECK(eur_amount BETWEEN 1 AND 10000), tokens int NOT NULL CHECK(tokens>0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','invoiced','credited','cancelled')), admin_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_orders_user ON token_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON token_orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS payment_orders (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), email text NOT NULL, package_id text NOT NULL, eur_amount int NOT NULL CHECK(eur_amount>=16), tokens int NOT NULL CHECK(tokens>0), provider_order_id text UNIQUE, checkout_url text, status text NOT NULL DEFAULT 'creating', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, expires_at timestamptz);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS bank_buyers (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, profile jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_seq (year int PRIMARY KEY, last_no int NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bank_orders (id uuid PRIMARY KEY, public_number text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, email text NOT NULL, eur_amount int NOT NULL CHECK(eur_amount BETWEEN 1 AND 2500), tokens int NOT NULL, buyer jsonb NOT NULL, seller jsonb NOT NULL, description text NOT NULL, terms_version text NOT NULL, terms_text text NOT NULL, consent_text text NOT NULL, status text NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','confirmed','partial','review','reported','credited','cancelled','refunded')), confirmed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_bank_orders_user ON bank_orders(user_id, confirmed_at);
CREATE TABLE IF NOT EXISTS bank_order_events (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_payments (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, sender_name text NOT NULL, amount_cents int NOT NULL CHECK(amount_cents>0), currency text NOT NULL DEFAULT 'EUR', received_date date NOT NULL, bank_ref text, payment_ref text, match_basis text, decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id, bank_ref));
CREATE TABLE IF NOT EXISTS bank_refunds (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, amount_cents int NOT NULL CHECK(amount_cents>0), status text NOT NULL DEFAULT 'requested', reason text NOT NULL DEFAULT '', bank_ref text, decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_evidence (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, file_name text NOT NULL, mime text NOT NULL, size_bytes int NOT NULL, sha256 text NOT NULL, uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_mail_log (order_id uuid PRIMARY KEY REFERENCES bank_orders(id) ON DELETE CASCADE, to_email text NOT NULL, subject text NOT NULL, body text NOT NULL, message_id text, state text NOT NULL, error text NOT NULL DEFAULT '', sent_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_order_documents (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bank_orders(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('confirmation','invoice','receipt')), doc_number text NOT NULL UNIQUE, version int NOT NULL DEFAULT 1, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_audit_log (id uuid PRIMARY KEY, order_id uuid REFERENCES bank_orders(id) ON DELETE SET NULL, actor_email text NOT NULL, action text NOT NULL, detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_bank_audit_order ON bank_audit_log(order_id, created_at);
CREATE TABLE IF NOT EXISTS payment_events (event_id text PRIMARY KEY, order_id uuid NOT NULL REFERENCES payment_orders(id), kind text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
	await pool.query(
		"ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false",
	);
	await pool.query("ALTER TABLE users ALTER COLUMN tokens SET DEFAULT 0");
	console.log("Schema ready");
} finally {
	await pool.end();
}
