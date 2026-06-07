import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { getUserById, type User } from "./users";
import { memberIds } from "./households";
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
  /** Whether the once-a-day digest email is sent. Independent of the email
   *  reminder channel above; defaults on. */
  digest: boolean;
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
  trip: [
    { daysBefore: 7, time: "09:00" },
    { daysBefore: 1, time: "18:00" },
  ],
  celebrate: [
    { daysBefore: 7, time: "09:00" }, // time to buy a card / gift
    { daysBefore: 0, time: "07:00" }, // on the day
  ],
  reminder: [{ daysBefore: 0, time: "09:00" }],
  fyi: [],
};

// Default to in-app push only. Email reminders are opt-in (the box is shown but
// unticked by default). This does NOT affect transactional email — family
// invites, password resets and magic links are always sent by email.
export const DEFAULT_CHANNELS: UserChannels = { email: false, push: true };

// The daily digest email is on by default (a gentle morning summary).
export const DEFAULT_DIGEST = true;

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
  let stored: { reminderRules?: unknown; channels?: unknown; digest?: unknown } =
    {};
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

  const digest = typeof stored.digest === "boolean" ? stored.digest : DEFAULT_DIGEST;

  return { rules, channels, digest };
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

/**
 * The guaranteed nudge for a task with an explicit time. If a task is due at a
 * specific time (`due_type === "datetime"`), the user should always be notified
 * at that time — regardless of the category's reminder settings (even `fyi`, or
 * a category the user has set to "no reminders"). Returns the exact due instant
 * as a UTC ISO string, or null when there's no future time to fire.
 */
export function exactTimeFire(
  task: Pick<Task, "due_at" | "due_type">,
  timezone: string,
  now: DateTime = DateTime.now(),
): string | null {
  if (task.due_type !== "datetime" || !task.due_at) return null;
  const due = DateTime.fromISO(task.due_at, { zone: timezone });
  if (!due.isValid) return null;
  if (due.toUTC() <= now.toUTC()) return null; // already passed
  return due.toUTC().toISO();
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
  for (const uid of await reminderTargets(task)) {
    await db.execute({
      sql: `INSERT INTO reminders (id, task_id, user_id, fire_at, channel, status, sent_at)
            VALUES (?,?,?,?,?,?,?)`,
      args: [newId("rem"), task.id, uid, fireAtUtcISO, "all", "pending", null],
    });
  }
}

/**
 * Who gets reminded for a task: the whole family for a shared task, otherwise
 * just the owner. (The assignee is shown as a label; per the family's choice
 * everyone is still nudged for shared tasks.)
 */
export async function reminderTargets(task: Task): Promise<string[]> {
  if (task.household_id) {
    const members = await memberIds(task.household_id);
    if (members.length > 0) return members;
  }
  return [task.user_id];
}

/**
 * (Re)generate reminders for a task: cancel any pending ones, then create fresh
 * rows. A task with an explicit time always gets a nudge at that time, on top
 * of any category rules. Category rules add extra advance reminders (and `fyi`
 * / empty categories add none). No-op for review/terminal tasks.
 * Call after create, confirm, due-date edits, and status changes.
 */
export async function generateRemindersForTask(task: Task): Promise<void> {
  await cancelRemindersForTask(task.id);
  if (task.status !== "active") return;

  const user = await getUserById(task.user_id);
  if (!user) return;

  const fires = new Set<string>();

  // Always notify at an explicit time, regardless of category settings.
  const exact = exactTimeFire(task, user.timezone);
  if (exact) fires.add(exact);

  // Category rules add any extra advance reminders (day-before, week-before…).
  const { rules } = parseUserSettings(user);
  const catRules = rules[task.category] ?? [];
  for (const f of computeFireTimes(task, catRules, user.timezone)) fires.add(f);

  const targets = await reminderTargets(task);

  for (const fireAt of fires) {
    for (const uid of targets) {
      await db.execute({
        sql: `INSERT INTO reminders (id, task_id, user_id, fire_at, channel, status, sent_at)
              VALUES (?,?,?,?,?,?,?)`,
        args: [newId("rem"), task.id, uid, fireAt, "all", "pending", null],
      });
    }
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
