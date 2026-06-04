import { db } from "./db";
import { newId } from "./ids";
import { config } from "./config";

export interface User {
  id: string;
  email: string;
  timezone: string;
  inbound_address: string | null;
  digest_hour: number;
  settings: string | null;
  created_at: string;
}

/**
 * Phase 1 stand-in for magic-link auth (SPEC §10a is a later phase). The app
 * operates as a single seeded user so extraction quality can be proven without
 * an email sender. Idempotent.
 */
export async function getOrCreateDefaultUser(): Promise<User> {
  const email = config.defaultUser.email;
  const existing = await db.execute({
    sql: "SELECT * FROM users WHERE email = ? LIMIT 1",
    args: [email],
  });
  if (existing.rows.length > 0) {
    return existing.rows[0] as unknown as User;
  }

  const id = newId("usr");
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO users (id, email, timezone, inbound_address, digest_hour, settings, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, email, config.defaultUser.timezone, null, 7, null, now],
  });
  return {
    id,
    email,
    timezone: config.defaultUser.timezone,
    inbound_address: null,
    digest_hour: 7,
    settings: null,
    created_at: now,
  };
}
