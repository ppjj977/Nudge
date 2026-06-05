import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { getUserById, type User } from "./users";
import type { Category } from "./categories";
import type { Task } from "./tasks";

/**
 * Reminder scheduling (SPEC §8). Each category has an ordered list of rules; a
 * rule fires N days before the task's due date at a fixed local time. This
 * covers the user-facing examples ("9pm the day before", "10am the morning of",
 * "1 week before"). Defaults below are editable per user in Settings.
 */
export interface ReminderRule {
  /** Days before the due date (0 = on the day). */
  daysBefore: number;
  /** Local time of day to fire, "HH:MM" (24h). */
  time: string;
}

export interface UserChannels {
  email: boolean;
  push: boolean;
}

export interface ReminderSettings {
  /** Per-category rule lists. A missing category falls back to defaults; an
   *  explicit empty array means "no reminders for this category". */
  rules: Partial<Record<Category, ReminderRule[]>>;
  channels: UserChannels;
}

/** SPEC §8 defaults, expressed in the (daysBefore, localTime) model. */
export const DEFAULT_REMINDER_RULES: Record<Category, ReminderRule[]> = {
  pay: [
    { daysBefore: 3, time: "09:00" },
    { daysBefore: 1, time: "09:00" },
    { daysBefore: 0, time: "09:00" },
  ],
  book: [
    { daysBefore: 7, time: "09:00" },
    { daysBefore: 2, time: "09:00" },
  ],
  attend: [
    { daysBefore: 1, time: "18:00" },
    { daysBefore: 0, time: "07:00" },
  ],
  prepare: [
    { daysBefore: 1, time: "18:00" },
    { daysBefore: 0, time: "07:00" },
  ],
  send: [
    { daysBefore: 1, time: "09:00" },
    { daysBefore: 0, time: "09:00" },
  ],
  renew: [
    { daysBefore: 14, time: "09:00" },
    { daysBefore: 3, time: "09:00" },
  ],
  reminder: [{ daysBefore: 0, time: "09:00" }],
  fyi: [],
};

export const DEFAULT_CHANNELS: UserChannels = { email: true, push: true };

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidRule(r: unknown): r is ReminderRule {
  return (
    !!r &&
    typeof (r as ReminderRule).daysBefore === "number" &&
    Number.isFinite((r as ReminderRule).daysBefore) &&
    (r as ReminderRule).daysBefore >= 0 &&
    typeof (r as ReminderRule).time === "string" &&
    TIME_RE.test((r as ReminderRule).time)
  );
}

/** Resolve a user's effective settings, merging stored prefs over defaults. */
export function parseUserSettings(user: Pick<User, "settings">): ReminderSettings {
  let stored: { reminderRules?: unknown; channels?: unknown } = {};
  if (user.settings) {
    try {
      stored = JSON.parse(user.settings) ?? {};
    } catch {
      stored = {};
    }
  }

  const rules: Partial<Record<Category, ReminderRule[]>> = {};
  const storedRules = (stored.reminderRules ?? {}) as Record<string, unknown>;
  for (const cat of Object.keys(DEFAULT_REMINDER_RULES) as Category[]) {
    const v = storedRules[cat];
    if (Array.isArray(v)) {
      // explicit (possibly empty) list overrides the default
      rules[cat] = v.filter(isValidRule);
    } else {
      rules[cat] = DEFAULT_REMINDER_RULES[cat];
    }
  }

  const ch = (stored.channels ?? {}) as Partial<UserChannels>;
  const channels: UserChannels = {
    email: typeof ch.email === "boolean" ? ch.email : DEFAULT_CHANNELS.email,
    push: typeof ch.push === "boolean" ? ch.push : DEFAULT_CHANNELS.push,
  };

  return { rules, channels };
}

/**
 * Compute the UTC ISO fire times for a task under a set of rules, in the user's
 * timezone. Anchors to the due date at each rule's local time. Past times are
 * skipped (SPEC §8). Tasks without a resolvable date get no reminders.
 */
export function computeFireTimes(
  task: Pick<Task, "due_at" | "due_type">,
  rules: ReminderRule[],
  timezone: string,
  now: DateTime = DateTime.now(),
): string[] {
  if (!task.due_at || task.due_type === "none") return [];
  const due = DateTime.fromISO(task.due_at, { zone: timezone });
  if (!due.isValid) return [];

  const nowUtc = now.toUTC();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rule of rules) {
    if (!isValidRule(rule)) continue;
    const [h, m] = rule.time.split(":").map((n) => parseInt(n, 10));
    const fire = due
      .minus({ days: rule.daysBefore })
      .set({ hour: h, minute: m, second: 0, millisecond: 0 });
    const iso = fire.toUTC().toISO();
    if (!iso) continue;
    if (fire.toUTC() <= nowUtc) continue; // skip past
    if (seen.has(iso)) continue;
    seen.add(iso);
    out.push(iso);
  }
  return out.sort();
}

/** Cancel a task's still-pending reminders (SPEC §5 note). */
export async function cancelRemindersForTask(taskId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE reminders SET status = 'cancelled' WHERE task_id = ? AND status = 'pending'",
    args: [taskId],
  });
}

/**
 * Snooze: schedule a single one-off nudge at an explicit time, without touching
 * the task's due date or its rule-based reminders. Used by the "Snooze → pick a
 * date & time" action.
 */
export async function snoozeTask(task: Task, fireAtUtcISO: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO reminders (id, task_id, user_id, fire_at, channel, status, sent_at)
          VALUES (?,?,?,?,?,?,?)`,
    args: [newId("rem"), task.id, task.user_id, fireAtUtcISO, "all", "pending", null],
  });
}

/**
 * (Re)generate reminders for a task: cancel any pending ones, then create fresh
 * rows from the user's rules. No-op for review/terminal tasks and `fyi`.
 * Call after create, confirm, due-date edits, and status changes.
 */
export async function generateRemindersForTask(task: Task): Promise<void> {
  await cancelRemindersForTask(task.id);
  if (task.status !== "active" || task.category === "fyi") return;

  const user = await getUserById(task.user_id);
  if (!user) return;

  const { rules } = parseUserSettings(user);
  const catRules = rules[task.category] ?? [];
  const fires = computeFireTimes(task, catRules, user.timezone);

  for (const fireAt of fires) {
    await db.execute({
      sql: `INSERT INTO reminders (id, task_id, user_id, fire_at, channel, status, sent_at)
            VALUES (?,?,?,?,?,?,?)`,
      args: [newId("rem"), task.id, task.user_id, fireAt, "all", "pending", null],
    });
  }
}

/** Regenerate reminders for all of a user's active tasks (after a rules edit). */
export async function regenerateAllForUser(userId: string): Promise<void> {
  const res = await db.execute({
    sql: "SELECT * FROM tasks WHERE user_id = ? AND status = 'active'",
    args: [userId],
  });
  for (const row of res.rows) {
    await generateRemindersForTask(row as unknown as Task);
  }
}
