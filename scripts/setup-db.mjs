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
CREATE TABLE IF NOT EXISTS payment_events (event_id text PRIMARY KEY, order_id uuid NOT NULL REFERENCES payment_orders(id), kind text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
	await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false");
	await pool.query("ALTER TABLE users ALTER COLUMN tokens SET DEFAULT 0");
	console.log("Schema ready");
} finally {
	await pool.end();
}
