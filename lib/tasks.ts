import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { config } from "./config";
import { generateRemindersForTask } from "./reminders";
import { advance, parseRecurrence, type Recurrence } from "./recurrence";
import type { ExtractionResult } from "./extract";
import { CATEGORIES } from "./categories";
import type { Category, DueType, TaskStatus } from "./categories";

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  capture_id: string | null;
  category: Category;
  title: string;
  detail: string | null;
  due_at: string | null;
  due_type: DueType;
  end_at: string | null;
  amount: number | null;
  currency: string | null;
  location: string | null;
  life_area: string | null;
  checklist: ChecklistItem[] | null;
  status: TaskStatus;
  confidence: number;
  source_excerpt: string | null;
  snoozed_until: string | null;
  household_id: string | null;
  assignee_id: string | null;
  recurrence: Recurrence | null;
  estimate_minutes: number | null;
  place_id: string | null;
  geo_trigger: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Parse a raw DB row, decoding the checklist JSON column into objects. */
function mapTaskRow(row: Record<string, unknown>): Task {
  let checklist: ChecklistItem[] | null = null;
  const raw = row.checklist;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        checklist = parsed
          .filter((i) => i && typeof i.text === "string")
          .map((i) => ({ text: i.text, done: Boolean(i.done) }));
      }
    } catch {
      checklist = null;
    }
  }
  const recurrence = parseRecurrence(row.recurrence);
  return { ...(row as unknown as Task), checklist, recurrence };
}

/**
 * Persist extracted items as tasks. High-confidence items go straight to the
 * timeline (`active`); items below the threshold land in the review tray
 * (`review`) (SPEC §7 rule 2). Returns the created tasks.
 */
export async function insertTasksFromExtraction(
  userId: string,
  captureId: string,
  result: ExtractionResult,
  threshold = config.extraction.confidenceThreshold,
): Promise<Task[]> {
  const created: Task[] = [];
  const now = new Date().toISOString();

  for (const item of result.items) {
    const status: TaskStatus =
      item.confidence < threshold ? "review" : "active";
    const id = newId("tsk");
    const checklist: ChecklistItem[] | null = item.checklist
      ? item.checklist.map((text) => ({ text, done: false }))
      : null;
    const checklistJson = checklist ? JSON.stringify(checklist) : null;
    await db.execute({
      sql: `INSERT INTO tasks
        (id, user_id, capture_id, category, title, detail, due_at, due_type, end_at,
         amount, currency, location, life_area, checklist, status, confidence,
         source_excerpt, recurrence, created_at, updated_at, completed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        userId,
        captureId,
        item.category,
        item.title,
        item.detail,
        item.due_at,
        item.due_type,
        item.end_at,
        item.amount,
        item.currency,
        item.location,
        item.life_area,
        checklistJson,
        status,
        item.confidence,
        item.source_excerpt,
        null,
        now,
        now,
        null,
      ],
    });
    const task: Task = {
      id,
      user_id: userId,
      capture_id: captureId,
      category: item.category,
      title: item.title,
      detail: item.detail,
      due_at: item.due_at,
      due_type: item.due_type,
      end_at: item.end_at,
      amount: item.amount,
      currency: item.currency,
      location: item.location,
      life_area: item.life_area,
      checklist,
      status,
      confidence: item.confidence,
      source_excerpt: item.source_excerpt,
      snoozed_until: null,
      household_id: null,
      assignee_id: null,
      recurrence: null,
      estimate_minutes: null,
      place_id: null,
      geo_trigger: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };
    created.push(task);
    // High-confidence tasks land active -> schedule their reminders now.
    // (Review-tray items get reminders when the user confirms them.)
    if (status === "active") await generateRemindersForTask(task);
  }
  return created;
}

// Patching any of these means the reminder schedule must be reconciled.
const REMINDER_RELEVANT = new Set([
  "status",
  "due_at",
  "due_type",
  "category",
]);

export type TimelineBucket = "today" | "week" | "later" | "unscheduled";

export interface Timeline {
  today: Task[];
  week: Task[];
  later: Task[];
  /** Dateless to-dos — kept out of "Later", which is for dated-but-distant. */
  unscheduled: Task[];
  review: Task[];
}

/**
 * Decide which timeline bucket a task falls in, relative to "now" in the user's
 * timezone (SPEC §9 grouping). Overdue items surface under Today.
 */
export function bucketFor(
  task: Pick<Task, "due_at" | "due_type">,
  now: DateTime,
): TimelineBucket {
  // Dateless to-dos get their own bucket rather than cluttering "Later".
  if (!task.due_at || task.due_type === "none") return "unscheduled";
  const due = DateTime.fromISO(task.due_at, { zone: now.zone });
  if (!due.isValid) return "unscheduled";

  const endOfToday = now.endOf("day");
  // "This week" means the rest of the current calendar week, ending Sunday.
  // Luxon weeks are ISO (Mon-Sun), so endOf('week') is this Sunday 23:59.
  const endOfWeek = now.endOf("week");
  if (due <= endOfToday) return "today"; // due today or overdue
  if (due <= endOfWeek) return "week";
  return "later";
}

/**
 * The unified timeline plus the review tray (SPEC §6, §10 GET /api/tasks).
 * `active` tasks are bucketed by due date; `review` tasks are listed separately.
 */
export async function getTimeline(
  userId: string,
  timezone: string,
): Promise<Timeline> {
  const res = await db.execute({
    sql: `SELECT * FROM tasks
          WHERE user_id = ? AND status IN ('active','review')
          ORDER BY (due_at IS NULL), due_at ASC, created_at DESC`,
    args: [userId],
  });
  const tasks = res.rows.map((r) => mapTaskRow(r as Record<string, unknown>));
  const now = DateTime.now().setZone(timezone);

  const timeline: Timeline = { today: [], week: [], later: [], unscheduled: [], review: [] };
  for (const t of tasks) {
    if (t.status === "review") {
      timeline.review.push(t);
      continue;
    }
    timeline[bucketFor(t, now)].push(t);
  }
  return timeline;
}

/** Fetch a task by id without scoping to a user (for the cron dispatcher). */
export async function getTaskByIdAny(id: string): Promise<Task | null> {
  const res = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ? LIMIT 1",
    args: [id],
  });
  return res.rows.length
    ? mapTaskRow(res.rows[0] as Record<string, unknown>)
    : null;
}

export interface ManualTaskInput {
  title: string;
  category?: string;
  detail?: string | null;
  due_at?: string | null;
  due_type?: DueType;
  end_at?: string | null;
  amount?: number | null;
  currency?: string | null;
  location?: string | null;
  life_area?: string | null;
  recurrence?: unknown;
}

/**
 * Create a task by hand (manual entry — the fallback path, SPEC §1). Lands
 * active with full confidence and schedules its reminders.
 */
export async function createManualTask(
  userId: string,
  input: ManualTaskInput,
): Promise<Task> {
  const id = newId("tsk");
  const now = new Date().toISOString();
  const category = (CATEGORIES as readonly string[]).includes(input.category ?? "")
    ? (input.category as Category)
    : "reminder";
  // If a date was given but no type, treat it as a date.
  const due_at = input.due_at && input.due_at.trim() ? input.due_at : null;
  const due_type: DueType = due_at
    ? input.due_type && input.due_type !== "none"
      ? input.due_type
      : "date"
    : "none";
  // A span only makes sense with a start, and the end must not precede it.
  const endRaw = input.end_at && input.end_at.trim() ? input.end_at.trim() : null;
  const end_at =
    due_at && endRaw && endRaw.slice(0, 10) >= due_at.slice(0, 10) ? endRaw : null;
  // Recurrence only makes sense with a date to anchor it to.
  const recurrence = due_at ? parseRecurrence(input.recurrence) : null;

  const task: Task = {
    id,
    user_id: userId,
    capture_id: null,
    category,
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    due_at,
    due_type,
    end_at,
    amount: category === "pay" ? (input.amount ?? null) : null,
    currency: category === "pay" ? (input.currency || "GBP") : null,
    location: input.location?.trim() || null,
    life_area: input.life_area?.trim() || null,
    checklist: null,
    status: "active",
    confidence: 1,
    source_excerpt: null,
    snoozed_until: null,
    household_id: null,
    assignee_id: null,
    recurrence,
    estimate_minutes: null,
    place_id: null,
    geo_trigger: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await db.execute({
    sql: `INSERT INTO tasks
      (id, user_id, capture_id, category, title, detail, due_at, due_type, end_at,
       amount, currency, location, life_area, checklist, status, confidence,
       source_excerpt, recurrence, created_at, updated_at, completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      task.id, task.user_id, task.capture_id, task.category, task.title,
      task.detail, task.due_at, task.due_type, task.end_at, task.amount, task.currency,
      task.location, task.life_area, null, task.status, task.confidence,
      task.source_excerpt, recurrence ? JSON.stringify(recurrence) : null,
      task.created_at, task.updated_at, task.completed_at,
    ],
  });
  await generateRemindersForTask(task);
  return task;
}

/** All active tasks (for the Money, Calendar, and Filter views). */
export async function getActiveTasks(
  userId: string,
  opts: { householdId?: string | null } = {},
): Promise<Task[]> {
  // When a household id is given, also include tasks shared with that family
  // (owned by another member) so shared tasks appear on the calendar/feed.
  const res = opts.householdId
    ? await db.execute({
        sql: `SELECT * FROM tasks
              WHERE status = 'active' AND (user_id = ? OR household_id = ?)
              ORDER BY (due_at IS NULL), due_at ASC, created_at DESC`,
        args: [userId, opts.householdId],
      })
    : await db.execute({
        sql: `SELECT * FROM tasks
              WHERE user_id = ? AND status = 'active'
              ORDER BY (due_at IS NULL), due_at ASC, created_at DESC`,
        args: [userId],
      });
  return res.rows.map((r) => mapTaskRow(r as Record<string, unknown>));
}

export type RecentTask = Task & { capture_source: string | null };

/**
 * Recently created tasks (any status except dismissed), newest first — powers
 * the "Recently added" view that confirms email/share/voice captures landed.
 * Joins the capture so we can show how each one arrived.
 */
export async function getRecentlyCreated(
  userId: string,
  limit = 30,
): Promise<RecentTask[]> {
  const res = await db.execute({
    sql: `SELECT t.*, c.source AS capture_source
          FROM tasks t LEFT JOIN captures c ON c.id = t.capture_id
          WHERE t.user_id = ? AND t.status IN ('active','review','done','paid')
          ORDER BY t.created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ...mapTaskRow(row),
      capture_source: (row.capture_source as string | null) ?? null,
    };
  });
}

/** Completed tasks (done/paid), most recently finished first — for the Done view. */
export async function getCompletedTasks(
  userId: string,
  limit = 100,
): Promise<Task[]> {
  const res = await db.execute({
    sql: `SELECT * FROM tasks
          WHERE user_id = ? AND status IN ('done','paid')
          ORDER BY completed_at DESC, updated_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => mapTaskRow(r as Record<string, unknown>));
}

export async function getTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const res = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ? AND user_id = ? LIMIT 1",
    args: [id, userId],
  });
  return res.rows.length
    ? mapTaskRow(res.rows[0] as Record<string, unknown>)
    : null;
}

const EDITABLE_FIELDS = new Set([
  "title",
  "detail",
  "due_at",
  "due_type",
  "end_at",
  "amount",
  "currency",
  "location",
  "life_area",
  "category",
  "checklist",
  "status",
  "assignee_id",
  "recurrence",
  "estimate_minutes",
  "place_id",
  "geo_trigger",
]);

/**
 * The task if the user owns it OR it's shared with a household they belong to.
 * Lets any family member act on shared tasks (complete, snooze, edit, dismiss).
 */
export async function getAccessibleTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const task = await getTaskByIdAny(id);
  if (!task) return null;
  if (task.user_id === userId) return task;
  if (task.household_id) {
    const m = await db.execute({
      sql: "SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1",
      args: [task.household_id, userId],
    });
    if (m.rows.length) return task;
  }
  return null;
}

/**
 * Patch a task. Sets completed_at when moving to a terminal done/paid status.
 * (Reminder regeneration/cancellation is wired in phase 2 — SPEC §5 note.)
 */
export async function updateTask(
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Task | null> {
  // Household-aware: the owner OR any member of the task's family may edit it.
  const existing = await getAccessibleTask(userId, id);
  if (!existing) return null;

  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    // checklist & recurrence are stored as JSON strings; accept an object/array
    // or a pre-encoded string (or null to clear).
    if (k === "checklist") {
      args.push(v == null ? null : typeof v === "string" ? v : JSON.stringify(v));
    } else if (k === "recurrence") {
      const rec = parseRecurrence(v);
      args.push(rec ? JSON.stringify(rec) : null);
    } else {
      args.push(v);
    }
  }

  const now = new Date().toISOString();
  if (patch.status === "done" || patch.status === "paid") {
    sets.push("completed_at = ?");
    args.push(now);
  } else if (typeof patch.status === "string") {
    // Un-completing (e.g. undo done -> active) clears the completion time.
    sets.push("completed_at = ?");
    args.push(null);
  }
  sets.push("updated_at = ?");
  args.push(now);

  if (sets.length === 1) return existing; // only updated_at -> nothing changed

  args.push(id);
  await db.execute({
    sql: `UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`,
    args: args as never[],
  });

  const updated = await getTaskByIdAny(id);

  // Reconcile reminders when a relevant field changed. generateRemindersForTask
  // cancels pending rows first, and is a no-op (just a cancel) for non-active
  // tasks — so this covers completion, dismissal, reschedule, and confirm.
  if (updated && Object.keys(patch).some((k) => REMINDER_RELEVANT.has(k))) {
    await generateRemindersForTask(updated);
  }

  // Completing a recurring task spawns its next occurrence (a fresh active task
  // with the dates rolled forward). Only on the transition *into* done/paid.
  const completedNow =
    (patch.status === "done" || patch.status === "paid") &&
    existing.status !== "done" &&
    existing.status !== "paid";
  if (updated && completedNow && updated.recurrence && updated.due_at) {
    await spawnNextOccurrence(updated);
  }

  return updated;
}

/**
 * Create the next instance of a recurring task: clone it with the due (and end)
 * dates advanced by one recurrence step, status active, checklist reset, and
 * fresh reminders. Returns null if the date can't be advanced.
 */
async function spawnNextOccurrence(task: Task): Promise<Task | null> {
  if (!task.recurrence || !task.due_at) return null;
  const nextDue = advance(task.due_at, task.recurrence);
  if (!nextDue) return null;
  const nextEnd = task.end_at ? advance(task.end_at, task.recurrence) : null;

  const id = newId("tsk");
  const now = new Date().toISOString();
  const checklist =
    task.checklist?.map((c) => ({ text: c.text, done: false })) ?? null;
  const next: Task = {
    ...task,
    id,
    due_at: nextDue,
    end_at: nextEnd,
    checklist,
    status: "active",
    snoozed_until: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await db.execute({
    sql: `INSERT INTO tasks
      (id, user_id, capture_id, category, title, detail, due_at, due_type, end_at,
       amount, currency, location, life_area, checklist, status, confidence,
       source_excerpt, snoozed_until, household_id, assignee_id, recurrence,
       created_at, updated_at, completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      next.id, next.user_id, next.capture_id, next.category, next.title,
      next.detail, next.due_at, next.due_type, next.end_at, next.amount,
      next.currency, next.location, next.life_area,
      checklist ? JSON.stringify(checklist) : null, next.status, next.confidence,
      next.source_excerpt, null, next.household_id, next.assignee_id,
      JSON.stringify(next.recurrence), next.created_at, next.updated_at, null,
    ],
  });
  await generateRemindersForTask(next);
  return next;
}

/** Promote a review-tray item to the live timeline (SPEC §10 confirm). */
export async function confirmTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  return updateTask(userId, id, { status: "active" });
}

/** Share a task with (or remove it from) a household; returns the updated row. */
export async function setTaskHousehold(
  userId: string,
  id: string,
  householdId: string | null,
): Promise<Task | null> {
  await db.execute({
    sql: "UPDATE tasks SET household_id = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    args: [householdId, new Date().toISOString(), id, userId],
  });
  return getTask(userId, id);
}

export interface FamilyTask extends Task {
  owner_name: string | null;
  owner_email: string;
  assignee_name: string | null;
}

/** Active tasks shared to a household, with each task's owner for attribution. */
export async function getFamilyTasks(householdId: string): Promise<FamilyTask[]> {
  const res = await db.execute({
    sql: `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
                 a.name AS assignee_name
          FROM tasks t
          JOIN users u ON u.id = t.user_id
          LEFT JOIN users a ON a.id = t.assignee_id
          WHERE t.household_id = ? AND t.status IN ('active','paid')
          ORDER BY (t.due_at IS NULL), t.due_at ASC, t.created_at DESC`,
    args: [householdId],
  });
  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...mapTaskRow(r),
      owner_name: (r.owner_name as string | null) ?? null,
      owner_email: r.owner_email as string,
      assignee_name: (r.assignee_name as string | null) ?? null,
    };
  });
}

/** Record when a task was snoozed to, so the card can show it persistently. */
export async function setSnoozedUntil(
  userId: string,
  id: string,
  isoUtc: string,
): Promise<void> {
  // id-scoped: access is verified by the route via getAccessibleTask.
  void userId;
  await db.execute({
    sql: "UPDATE tasks SET snoozed_until = ?, updated_at = ? WHERE id = ?",
    args: [isoUtc, new Date().toISOString(), id],
  });
}

/** Dismiss/delete a task (SPEC §10 DELETE). We soft-delete to keep the audit. */
export async function dismissTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  return updateTask(userId, id, { status: "dismissed" });
}
