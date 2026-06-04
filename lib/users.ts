import { randomBytes } from "node:crypto";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { config } from "./config";
import { DEFAULT_LIFE_AREAS } from "./categories";

/** A user's life areas (customisable). Falls back to the defaults. */
export function getUserLifeAreas(user: Pick<User, "settings">): string[] {
  if (user.settings) {
    try {
      const parsed = JSON.parse(user.settings);
      const areas = parsed?.lifeAreas;
      if (Array.isArray(areas)) {
        const cleaned = areas
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim());
        if (cleaned.length > 0) return cleaned;
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return DEFAULT_LIFE_AREAS;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
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
export async function getUserById(id: string): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
    args: [id],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

export async function getAllUsers(): Promise<User[]> {
  await ensureSchema();
  const res = await db.execute("SELECT * FROM users");
  return res.rows as unknown as User[];
}

/** Resolve the per-user email-in token (the local part) to a user. */
export async function findUserByInboundLocalPart(
  localPart: string,
): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE inbound_address = ? LIMIT 1",
    args: [localPart.toLowerCase().trim()],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

/** Full email-in address for a user, e.g. nudge-ab12@in.nudgelive.co.uk. */
export function inboundAddressFor(user: Pick<User, "inbound_address">): string | null {
  if (!user.inbound_address || !config.inbound.domain) return null;
  return `${user.inbound_address}@${config.inbound.domain}`;
}

/**
 * Guarantee a user has an inbound token (older/seeded rows predate it), then
 * return the full address if an inbound domain is configured.
 */
export async function ensureInboundAddress(
  user: Pick<User, "id" | "inbound_address">,
): Promise<string | null> {
  let token = user.inbound_address;
  if (!token) {
    token = `nudge-${randomBytes(5).toString("hex")}`;
    await db.execute({
      sql: "UPDATE users SET inbound_address = ? WHERE id = ?",
      args: [token, user.id],
    });
  }
  return config.inbound.domain ? `${token}@${config.inbound.domain}` : null;
}

/** Persist a user's settings JSON (reminder rules + channels). */
export async function updateUserSettings(
  id: string,
  settings: unknown,
  digestHour?: number,
): Promise<void> {
  if (typeof digestHour === "number") {
    await db.execute({
      sql: "UPDATE users SET settings = ?, digest_hour = ? WHERE id = ?",
      args: [JSON.stringify(settings), digestHour, id],
    });
  } else {
    await db.execute({
      sql: "UPDATE users SET settings = ? WHERE id = ?",
      args: [JSON.stringify(settings), id],
    });
  }
}

export async function getOrCreateDefaultUser(): Promise<User> {
  // Every runtime path (page + API routes) calls this first, so it is the
  // natural place to guarantee the schema exists (see ensureSchema rationale).
  await ensureSchema();
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
    name: null,
    image: null,
    timezone: config.defaultUser.timezone,
    inbound_address: null,
    digest_hour: 7,
    settings: null,
    created_at: now,
  };
}
