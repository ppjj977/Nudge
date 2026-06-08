import { loadEnv } from "./_env";

/**
 * Seed a demo / Play-review account: a known email + password, comped to Pro so
 * reviewers can see every feature, with a small, realistic timeline so the app
 * isn't empty on first open. Idempotent — safe to re-run.
 *
 *   DEMO_EMAIL / DEMO_PASSWORD override the defaults.
 *   npx tsx scripts/seed-demo.ts
 */
async function main() {
  loadEnv();
  const { db, ensureSchema } = await import("../lib/db");
  const { newId } = await import("../lib/ids");
  const { hashPassword } = await import("../lib/auth");
  const { DateTime } = await import("luxon");

  await ensureSchema();
  const email = (process.env.DEMO_EMAIL ?? "reviewer@nudgelive.co.uk").toLowerCase();
  const password = process.env.DEMO_PASSWORD ?? "NudgeDemo2026!";
  const now = new Date().toISOString();

  // Upsert the user.
  let userId: string;
  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
    args: [email],
  });
  if (existing.rows.length) {
    userId = String((existing.rows[0] as unknown as { id: string }).id);
  } else {
    userId = newId("usr");
    await db.execute({
      sql: `INSERT INTO users (id, email, name, timezone, digest_hour, created_at)
            VALUES (?,?,?,?,?,?)`,
      args: [userId, email, "Review Account", "Europe/London", 7, now],
    });
  }

  // Password + comp to Pro (perpetual) so all features are visible.
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, plan = 'pro', plan_until = NULL, plan_source = 'comp' WHERE id = ?",
    args: [hashPassword(password), userId],
  });

  // Seed a few tasks only if the account has none.
  const count = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?",
    args: [userId],
  });
  if (Number((count.rows[0] as { n?: number })?.n ?? 0) === 0) {
    const d = (days: number, hour?: number) => {
      let t = DateTime.now().setZone("Europe/London").plus({ days });
      if (hour != null) t = t.set({ hour, minute: 0, second: 0 });
      return t.toUTC().toISO();
    };
    const tasks: [string, string, string, string | null, string, number?][] = [
      // title, category, life_area, due_at, due_type, hour-flag handled above
      ["Bring PE kit to school", "prepare", "school", d(1, 8), "datetime"],
      ["Pay £15 school trip", "pay", "money", d(3), "date"],
      ["Book dentist check-up", "book", "health", d(5), "date"],
      ["Reply to Dana's email", "send", "work", d(2, 9), "datetime"],
      ["Mum's birthday", "fyi", "personal", d(9), "date"],
    ];
    for (const [title, category, life_area, due_at, due_type] of tasks) {
      const id = newId("tsk");
      await db.execute({
        sql: `INSERT INTO tasks
          (id, user_id, capture_id, category, title, detail, due_at, due_type, end_at,
           amount, currency, location, life_area, checklist, status, confidence,
           source_excerpt, recurrence, created_at, updated_at, completed_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          id, userId, null, category, title, null, due_at, due_type, null,
          category === "pay" ? 15 : null, category === "pay" ? "GBP" : null,
          null, life_area, null, "active", 0.95, null, null, now, now, null,
        ],
      });
    }
    console.log("  seeded 5 sample tasks");
  }

  console.log("Demo account ready:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  plan:     pro (comp)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
