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

const SCHEMA = `CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL, tokens int NOT NULL DEFAULT 500, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title text NOT NULL, mode text NOT NULL CHECK(mode IN ('text','image','video')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS runs (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, mode text NOT NULL CHECK(mode IN ('text','image','video')), prompt text NOT NULL, result text, provider_job_id text, tokens_spent int NOT NULL DEFAULT 0, status text NOT NULL CHECK(status IN ('pending','completed','failed')), error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id, created_at ASC);
CREATE TABLE IF NOT EXISTS token_transactions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount int NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tokens_user ON token_transactions(user_id, created_at DESC);`;

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

export function db(): Pool | Queryable {
	if (!process.env.DATABASE_URL)
		throw new ConfigurationError(
			"DATABASE_URL is not configured yet. Account and saved history require PostgreSQL.",
		);
	if (!pool || !(pool instanceof Pool))
		pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
	return pool as Pool;
}

export async function dbAsync(): Promise<Pool | Queryable> {
	// Test-only fallback: in-process PostgreSQL-compatible database (no persistence).
	if (process.env.DATABASE_URL) return db() as Pool;
	if (process.env.VELORA_TEST_DB === "memory") return memoryDb();
	throw new ConfigurationError(
		"DATABASE_URL is not configured yet. Account and saved history require PostgreSQL.",
	);
}
