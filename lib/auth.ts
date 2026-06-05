import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { config } from "./config";
import type { User } from "./users";

const SESSION_COOKIE = "nudge_session";
const SESSION_DAYS = 60;

/** Thrown by provisionUser when sign-up is closed and the user doesn't exist. */
export class RegistrationClosedError extends Error {
  constructor() {
    super("Sign-ups aren’t open yet.");
    this.name = "RegistrationClosedError";
  }
}

/* -------------------------------------------------------------------------- */
/* Passwords (scrypt, no external dependency)                                  */
/* -------------------------------------------------------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export async function findUserByEmail(email: string): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE email = ? LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

/**
 * Find a user by email or provision a new one. New users get a default
 * timezone, digest hour, and a unique inbound forwarding token (used by
 * email-in later).
 */
export async function provisionUser(
  email: string,
  extra: { name?: string | null; image?: string | null } = {},
): Promise<User> {
  await ensureSchema();
  const normalized = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalized);
  if (existing) {
    // Backfill name/image from a richer provider (e.g. Google) if missing.
    if ((!existing.name && extra.name) || (!existing.image && extra.image)) {
      await db.execute({
        sql: "UPDATE users SET name = COALESCE(name, ?), image = COALESCE(image, ?) WHERE id = ?",
        args: [extra.name ?? null, extra.image ?? null, existing.id],
      });
    }
    return (await findUserByEmail(normalized))!;
  }
  // No existing account: block creation while sign-up is closed (pre-launch).
  if (!config.registrationOpen) {
    throw new RegistrationClosedError();
  }
  const id = newId("usr");
  const now = new Date().toISOString();
  const inbound = `nudge-${randomBytes(5).toString("hex")}`;
  await db.execute({
    sql: `INSERT INTO users (id, email, name, image, timezone, inbound_address, digest_hour, settings, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      normalized,
      extra.name ?? null,
      extra.image ?? null,
      config.defaultUser.timezone,
      inbound,
      7,
      null,
      now,
    ],
  });
  return (await findUserByEmail(normalized))!;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [hashPassword(password), userId],
  });
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  const row = res.rows[0] as { password_hash?: string | null } | undefined;
  return row?.password_hash ?? null;
}

export async function updateUserName(userId: string, name: string | null): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE users SET name = ? WHERE id = ?",
    args: [name, userId],
  });
}

/** True if another user already owns this email. */
export async function emailTaken(email: string, exceptUserId: string): Promise<boolean> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
    args: [email.toLowerCase().trim(), exceptUserId],
  });
  return res.rows.length > 0;
}

export async function updateUserEmail(userId: string, email: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE users SET email = ? WHERE id = ?",
    args: [email.toLowerCase().trim(), userId],
  });
}

/* -------------------------------------------------------------------------- */
/* Sessions (server-side; cookie holds a random id)                            */
/* -------------------------------------------------------------------------- */

export async function createSession(userId: string): Promise<void> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  const now = DateTime.now();
  await db.execute({
    sql: "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?,?,?,?)",
    args: [token, userId, now.plus({ days: SESSION_DAYS }).toISO(), now.toISO()],
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [token] });
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call from server components + routes. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > ? LIMIT 1`,
    args: [token, new Date().toISOString()],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

/** Require a signed-in user in a page; redirect to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/* -------------------------------------------------------------------------- */
/* Magic-link tokens                                                           */
/* -------------------------------------------------------------------------- */

export async function createMagicToken(email: string): Promise<string> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  await db.execute({
    sql: `INSERT INTO auth_tokens (id, token_hash, email, purpose, expires_at, used_at)
          VALUES (?,?,?,?,?,?)`,
    args: [
      newId("tok"),
      sha256(token),
      email.toLowerCase().trim(),
      "magic",
      DateTime.now().plus({ minutes: 15 }).toISO(),
      null,
    ],
  });
  return token;
}

/** Consume a magic-link token, returning the email if valid + unused + fresh. */
export async function consumeMagicToken(token: string): Promise<string | null> {
  await ensureSchema();
  const hash = sha256(token);
  const res = await db.execute({
    sql: "SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = 'magic' LIMIT 1",
    args: [hash],
  });
  const row = res.rows[0] as unknown as
    | { id: string; email: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at) return null;
  if (DateTime.fromISO(row.expires_at) < DateTime.now()) return null;
  await db.execute({
    sql: "UPDATE auth_tokens SET used_at = ? WHERE id = ?",
    args: [new Date().toISOString(), row.id],
  });
  return row.email;
}

export function googleEnabled(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}
