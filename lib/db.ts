import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

/**
 * libSQL client (SPEC §3). A module-level singleton so the Next dev server's
 * hot-reload does not open a new connection on every request.
 */
declare global {
  // eslint-disable-next-line no-var
  var __relayDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __relaySchemaReady: Promise<void> | undefined;
}

export const db: Client =
  globalThis.__relayDb ??
  createClient({
    url: config.db.url,
    authToken: config.db.authToken,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__relayDb = db;
}

/**
 * Ensure the schema exists before the first query. Render's free plan skips
 * `preDeployCommand`, so we cannot rely on a separate migrate step running in
 * production — the app self-heals instead. CREATE TABLE IF NOT EXISTS makes
 * this idempotent; the work is memoized so it runs at most once per process.
 */
export function ensureSchema(): Promise<void> {
  if (!globalThis.__relaySchemaReady) {
    globalThis.__relaySchemaReady = applySchema().catch((err) => {
      // Reset so a transient failure can be retried on the next request.
      globalThis.__relaySchemaReady = undefined;
      throw err;
    });
  }
  return globalThis.__relaySchemaReady;
}

async function applySchema(): Promise<void> {
  const sql = readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf8");
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  await applyAdditiveMigrations();
}

/**
 * Idempotent column additions for databases created before a column existed
 * (CREATE TABLE IF NOT EXISTS won't add new columns to an existing table).
 * Each entry is safe to run repeatedly — a duplicate-column error is ignored.
 */
async function applyAdditiveMigrations(): Promise<void> {
  const additions = [
    "ALTER TABLE tasks ADD COLUMN checklist TEXT",
    "ALTER TABLE tasks ADD COLUMN snoozed_until TEXT",
    "ALTER TABLE users ADD COLUMN name TEXT",
    "ALTER TABLE users ADD COLUMN image TEXT",
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
  ];
  for (const stmt of additions) {
    try {
      await db.execute(stmt);
    } catch (err) {
      const msg = (err as Error).message?.toLowerCase() ?? "";
      if (!msg.includes("duplicate column")) throw err;
    }
  }
}
