import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { config } from "./config";
import type { ExtractionResult } from "./extract";
import type { Category, DueType, LifeArea, TaskStatus } from "./categories";

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
  life_area: LifeArea | null;
  checklist: ChecklistItem[] | null;
  status: TaskStatus;
  confidence: number;
  source_excerpt: string | null;
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
    created.push({
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
      created_at: now,
      updated_at: now,
      completed_at: null,
    });
  }
  return created;
}

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

  const startOfToday = now.startOf("day");
  const endOfToday = now.endOf("day");
  if (due <= endOfToday) return "today"; // due today or overdue
  if (due <= startOfToday.plus({ days: 7 })) return "week";
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
]);

/**
 * Patch a task. Sets completed_at when moving to a terminal done/paid status.
 * (Reminder regeneration/cancellation is wired in phase 2 — SPEC §5 note.)
 */
export async function updateTask(
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Task | null> {
  const existing = await getTask(userId, id);
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
  }
  sets.push("updated_at = ?");
  args.push(now);

  if (sets.length === 1) return existing; // only updated_at -> nothing changed

  args.push(id, userId);
  await db.execute({
    sql: `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    args: args as never[],
  });
  return getTask(userId, id);
}

/** Promote a review-tray item to the live timeline (SPEC §10 confirm). */
export async function confirmTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  return updateTask(userId, id, { status: "active" });
}

/** Dismiss/delete a task (SPEC §10 DELETE). We soft-delete to keep the audit. */
export async function dismissTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  return updateTask(userId, id, { status: "dismissed" });
}
