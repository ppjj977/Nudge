import { db, ensureSchema } from "./db";
import { newId } from "./ids";

/**
 * Pre-launch waitlist. While public sign-up is closed (config.registrationOpen
 * === false) the marketing site funnels people here. The first N signups are
 * the "first 10 free for life" cohort — `position` records join order so we
 * can honour that promise when we open the doors.
 */
export const FREE_FOR_LIFE_COHORT = 10;

export interface InterestSignup {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  source: string | null;
  position: number;
  created_at: string;
}

export type JoinResult =
  | { ok: true; position: number; freeForLife: boolean }
  | { ok: false; reason: "exists"; position: number; freeForLife: boolean }
  | { ok: false; reason: "invalid" };

/** Add someone to the waitlist (idempotent on email). */
export async function joinWaitlist(input: {
  email: string;
  name?: string | null;
  note?: string | null;
  source?: string | null;
}): Promise<JoinResult> {
  await ensureSchema();
  const email = input.email.toLowerCase().trim();
  if (!email || !email.includes("@") || email.length > 254) {
    return { ok: false, reason: "invalid" };
  }

  const existing = await db.execute({
    sql: "SELECT position FROM interest_signups WHERE email = ? LIMIT 1",
    args: [email],
  });
  if (existing.rows.length) {
    const position = Number((existing.rows[0] as unknown as { position: number }).position);
    return { ok: false, reason: "exists", position, freeForLife: position <= FREE_FOR_LIFE_COHORT };
  }

  const countRes = await db.execute("SELECT COUNT(*) AS n FROM interest_signups");
  const position = Number((countRes.rows[0] as { n?: number })?.n ?? 0) + 1;

  await db.execute({
    sql: `INSERT INTO interest_signups (id, email, name, note, source, position, created_at)
          VALUES (?,?,?,?,?,?,?)`,
    args: [
      newId("int"),
      email,
      input.name?.trim() || null,
      input.note?.trim() || null,
      input.source?.trim() || null,
      position,
      new Date().toISOString(),
    ],
  });
  return { ok: true, position, freeForLife: position <= FREE_FOR_LIFE_COHORT };
}

export async function interestCount(): Promise<number> {
  await ensureSchema();
  const r = await db.execute("SELECT COUNT(*) AS n FROM interest_signups");
  return Number((r.rows[0] as { n?: number })?.n ?? 0);
}

export async function listInterest(limit = 200): Promise<InterestSignup[]> {
  await ensureSchema();
  const r = await db.execute({
    sql: "SELECT * FROM interest_signups ORDER BY position ASC LIMIT ?",
    args: [limit],
  });
  return r.rows as unknown as InterestSignup[];
}
