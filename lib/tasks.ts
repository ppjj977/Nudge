import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { config } from "./config";
import { generateRemindersForTask } from "./reminders";
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
  return { ...(row as unknown as Task), checklist };
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
        (id, user_id, capture_id, category, title, detail, due_at, due_type,
         amount, currency, location, life_area, checklist, status, confidence,
         source_excerpt, created_at, updated_at, completed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        userId,
        captureId,
        item.category,
        item.title,
        item.detail,
        item.due_at,
        item.due_type,
        item.amount,
        item.currency,
        item.location,
        item.life_area,
        checklistJson,
        status,
        item.confidence,
        item.source_excerpt,
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

export type TimelineBucket = "today" | "week" | "later";

export interface Timeline {
  today: Task[];
  week: Task[];
  later: Task[];
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
  if (!task.due_at || task.due_type === "none") return "later";
  const due = DateTime.fromISO(task.due_at, { zone: now.zone });
  if (!due.isValid) return "later";

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

  const timeline: Timeline = { today: [], week: [], later: [], review: [] };
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
  amount?: number | null;
  currency?: string | null;
  location?: string | null;
  life_area?: string | null;
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

  const task: Task = {
    id,
    user_id: userId,
    capture_id: null,
    category,
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    due_at,
    due_type,
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
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await db.execute({
    sql: `INSERT INTO tasks
      (id, user_id, capture_id, category, title, detail, due_at, due_type,
       amount, currency, location, life_area, checklist, status, confidence,
       source_excerpt, created_at, updated_at, completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      task.id, task.user_id, task.capture_id, task.category, task.title,
      task.detail, task.due_at, task.due_type, task.amount, task.currency,
      task.location, task.life_area, null, task.status, task.confidence,
      task.source_excerpt, task.created_at, task.updated_at, task.completed_at,
    ],
  });
  await generateRemindersForTask(task);
  return task;
}

/** All active tasks (for the Money, Calendar, and Filter views). */
export async function getActiveTasks(userId: string): Promise<Task[]> {
  const res = await db.execute({
    sql: `SELECT * FROM tasks
          WHERE user_id = ? AND status = 'active'
          ORDER BY (due_at IS NULL), due_at ASC, created_at DESC`,
    args: [userId],
  });
  return res.rows.map((r) => mapTaskRow(r as Record<string, unknown>));
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
  "amount",
  "currency",
  "location",
  "life_area",
  "category",
  "checklist",
  "status",
  "assignee_id",
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
    // checklist is stored as a JSON string; accept an array or pre-encoded string
    if (k === "checklist") {
      args.push(v == null ? null : typeof v === "string" ? v : JSON.stringify(v));
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

  return updated;
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
