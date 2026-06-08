import { DateTime } from "luxon";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { hashPassword } from "./auth";

/**
 * Create (or refresh) a demo / Play-review account: a known email + password,
 * comped to Pro so every feature is visible, with a small realistic timeline so
 * the app isn't empty on first open. Idempotent. Used by both the admin button
 * (/api/admin/demo) and scripts/seed-demo.ts.
 */
export const DEMO_DEFAULT_EMAIL = "reviewer@nudgelive.co.uk";
export const DEMO_DEFAULT_PASSWORD = "NudgeDemo2026!";

export interface SeedDemoResult {
  email: string;
  password: string;
  created: boolean;
  seededTasks: number;
}

export async function seedDemoAccount(opts?: {
  email?: string;
  password?: string;
}): Promise<SeedDemoResult> {
  await ensureSchema();
  const email = (opts?.email || DEMO_DEFAULT_EMAIL).toLowerCase().trim();
  const password = opts?.password || DEMO_DEFAULT_PASSWORD;
  const now = new Date().toISOString();

  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
    args: [email],
  });
  let userId: string;
  let created = false;
  if (existing.rows.length) {
    userId = String((existing.rows[0] as unknown as { id: string }).id);
  } else {
    userId = newId("usr");
    created = true;
    await db.execute({
      sql: `INSERT INTO users (id, email, name, timezone, digest_hour, created_at)
            VALUES (?,?,?,?,?,?)`,
      args: [userId, email, "Review Account", "Europe/London", 7, now],
    });
  }

  // Set the password and comp to Pro (perpetual).
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, plan = 'pro', plan_until = NULL, plan_source = 'comp' WHERE id = ?",
    args: [hashPassword(password), userId],
  });

  // Seed a few tasks only if the account has none.
  let seededTasks = 0;
  const count = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?",
    args: [userId],
  });
  if (Number((count.rows[0] as { n?: number })?.n ?? 0) === 0) {
    const at = (days: number, hour?: number) => {
      let t = DateTime.now().setZone("Europe/London").plus({ days });
      if (hour != null) t = t.set({ hour, minute: 0, second: 0 });
      return t.toUTC().toISO();
    };
    const tasks: [string, string, string, string | null, string][] = [
      ["Bring PE kit to school", "prepare", "school", at(1, 8), "datetime"],
      ["Pay £15 school trip", "pay", "money", at(3), "date"],
      ["Book dentist check-up", "book", "health", at(5), "date"],
      ["Reply to Dana's email", "send", "work", at(2, 9), "datetime"],
      ["Mum's birthday", "fyi", "personal", at(9), "date"],
    ];
    for (const [title, category, life_area, due_at, due_type] of tasks) {
      await db.execute({
        sql: `INSERT INTO tasks
          (id, user_id, capture_id, category, title, detail, due_at, due_type, end_at,
           amount, currency, location, life_area, checklist, status, confidence,
           source_excerpt, recurrence, created_at, updated_at, completed_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          newId("tsk"), userId, null, category, title, null, due_at, due_type, null,
          category === "pay" ? 15 : null, category === "pay" ? "GBP" : null,
          null, life_area, null, "active", 0.95, null, null, now, now, null,
        ],
      });
      seededTasks++;
    }
  }

  return { email, password, created, seededTasks };
}
