import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import type { User } from "./users";

/**
 * Monetization framework (billing-agnostic). Entitlement = a `plan` of 'free'
 * or 'pro' on the user, optionally time-limited via `plan_until`. Free users
 * get a monthly cap on AI captures (the cost driver); Pro is unlimited.
 *
 * Granting Pro is decoupled from *how* it's paid for: a future Play/Stripe
 * webhook, an admin comp, or a redeemed promo code all just call setPlan().
 */
export const FREE_MONTHLY_CAPTURES = 10;

type PlanFields = Pick<User, "plan" | "plan_until">;

/** Is this user currently entitled to Pro? */
export function isPro(user: PlanFields | null | undefined): boolean {
  if (!user || user.plan !== "pro") return false;
  if (!user.plan_until) return true; // perpetual
  const until = DateTime.fromISO(user.plan_until);
  return !until.isValid || until > DateTime.now();
}

/** AI captures used in the current calendar month. */
export async function monthlyCaptureCount(
  userId: string,
  now: DateTime = DateTime.now(),
): Promise<number> {
  const start = now.startOf("month").toUTC().toISO();
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM captures WHERE user_id = ? AND received_at >= ?",
    args: [userId, start],
  });
  return Number((res.rows[0] as { n?: number })?.n ?? 0);
}

export interface Allowance {
  pro: boolean;
  used: number;
  limit: number; // -1 = unlimited
  allowed: boolean;
}

/** Whether the user may run another AI capture right now. */
export async function captureAllowance(
  user: Pick<User, "id" | "plan" | "plan_until">,
): Promise<Allowance> {
  if (isPro(user)) return { pro: true, used: 0, limit: -1, allowed: true };
  const used = await monthlyCaptureCount(user.id);
  return { pro: false, used, limit: FREE_MONTHLY_CAPTURES, allowed: used < FREE_MONTHLY_CAPTURES };
}

/* ----------------------------- granting ----------------------------------- */

export async function setPlan(
  userId: string,
  plan: "free" | "pro",
  until: string | null,
  source: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET plan = ?, plan_until = ?, plan_source = ? WHERE id = ?",
    args: [plan, until, source, userId],
  });
}

/** Comp a user to Pro by email (admin). durationDays null = forever. */
export async function grantProByEmail(
  email: string,
  durationDays: number | null,
): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1",
    args: [email.trim()],
  });
  if (!r.rows.length) return false;
  const id = String((r.rows[0] as unknown as { id: string }).id);
  const until = durationDays
    ? DateTime.now().plus({ days: durationDays }).toUTC().toISO()
    : null;
  await setPlan(id, "pro", until, "comp");
  return true;
}

/* --------------------------- promo codes ---------------------------------- */

export interface PromoCode {
  code: string;
  duration_days: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  note: string | null;
  created_at: string;
}

export async function createPromoCode(input: {
  code: string;
  durationDays: number | null;
  maxRedemptions: number | null;
  note?: string | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO promo_codes
            (code, grants, duration_days, max_redemptions, redeemed_count, expires_at, note, created_at)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [
      input.code.trim().toUpperCase(),
      "pro",
      input.durationDays,
      input.maxRedemptions,
      0,
      null,
      input.note ?? null,
      new Date().toISOString(),
    ],
  });
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const r = await db.execute("SELECT * FROM promo_codes ORDER BY created_at DESC");
  return r.rows as unknown as PromoCode[];
}

export type RedeemResult = "ok" | "invalid" | "exhausted" | "expired" | "already";

/** Redeem a code for the given user, granting Pro per the code's terms. */
export async function redeemCode(userId: string, codeRaw: string): Promise<RedeemResult> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return "invalid";
  const r = await db.execute({
    sql: "SELECT * FROM promo_codes WHERE code = ? LIMIT 1",
    args: [code],
  });
  if (!r.rows.length) return "invalid";
  const pc = r.rows[0] as unknown as PromoCode;
  if (pc.expires_at && DateTime.fromISO(pc.expires_at) < DateTime.now()) return "expired";
  if (pc.max_redemptions != null && pc.redeemed_count >= pc.max_redemptions) {
    return "exhausted";
  }
  const already = await db.execute({
    sql: "SELECT 1 FROM promo_redemptions WHERE code = ? AND user_id = ? LIMIT 1",
    args: [code, userId],
  });
  if (already.rows.length) return "already";

  const until = pc.duration_days
    ? DateTime.now().plus({ days: pc.duration_days }).toUTC().toISO()
    : null;
  await setPlan(userId, "pro", until, `promo:${code}`);
  await db.execute({
    sql: "INSERT INTO promo_redemptions (id, code, user_id, redeemed_at) VALUES (?,?,?,?)",
    args: [newId("red"), code, userId, new Date().toISOString()],
  });
  await db.execute({
    sql: "UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?",
    args: [code],
  });
  return "ok";
}

/* ----------------------------- admin: users ------------------------------- */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  plan: string | null;
  plan_until: string | null;
  plan_source: string | null;
  created_at: string;
  pro: boolean;
}

/** All users (newest first) with a computed live-Pro flag, for the admin table. */
export async function listUsersForAdmin(limit = 500): Promise<AdminUserRow[]> {
  const r = await db.execute({
    sql: `SELECT id, email, name, plan, plan_until, plan_source, created_at
          FROM users ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return (r.rows as unknown as Omit<AdminUserRow, "pro">[]).map((u) => ({
    ...u,
    pro: isPro(u),
  }));
}

/** Set a user's plan directly by id (admin comp / revoke). */
export async function setPlanById(userId: string, pro: boolean): Promise<void> {
  await setPlan(userId, pro ? "pro" : "free", null, pro ? "comp" : "admin-revoke");
}

/* ----------------------------- admin stats -------------------------------- */

export interface PlanStats {
  total: number;
  pro: number;
  free: number;
  comp: number;
  promo: number;
  expiringSoon: number; // pro expiring within 7 days
}

function num(res: { rows: unknown[] }): number {
  return Number((res.rows[0] as { n?: number })?.n ?? 0);
}

export async function planStats(): Promise<PlanStats> {
  const now = DateTime.now().toUTC().toISO();
  const soon = DateTime.now().plus({ days: 7 }).toUTC().toISO();
  const live = "plan='pro' AND (plan_until IS NULL OR plan_until > ?)";
  const total = num(await db.execute("SELECT COUNT(*) AS n FROM users"));
  const pro = num(await db.execute({ sql: `SELECT COUNT(*) AS n FROM users WHERE ${live}`, args: [now] }));
  const comp = num(
    await db.execute({
      sql: `SELECT COUNT(*) AS n FROM users WHERE plan_source='comp' AND ${live}`,
      args: [now],
    }),
  );
  const promo = num(
    await db.execute({
      sql: `SELECT COUNT(*) AS n FROM users WHERE plan_source LIKE 'promo:%' AND ${live}`,
      args: [now],
    }),
  );
  const expiringSoon = num(
    await db.execute({
      sql: "SELECT COUNT(*) AS n FROM users WHERE plan='pro' AND plan_until IS NOT NULL AND plan_until > ? AND plan_until <= ?",
      args: [now, soon],
    }),
  );
  return { total, pro, free: total - pro, comp, promo, expiringSoon };
}
