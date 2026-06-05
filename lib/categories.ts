/**
 * The fixed category + enum vocabulary (SPEC §7, §5). Kept in one place so the
 * extractor schema, the DB writer, and the UI all agree. Do not exceed these —
 * more categories means more misclassification (SPEC §7).
 */

export const ACTION_CATEGORIES = [
  "pay",
  "book",
  "attend",
  "prepare",
  "send",
  "renew",
  "trip",
  "reminder",
] as const;

export const CATEGORIES = [...ACTION_CATEGORIES, "fyi"] as const;
export type Category = (typeof CATEGORIES)[number];

export const DUE_TYPES = ["datetime", "date", "none"] as const;
export type DueType = (typeof DUE_TYPES)[number];

export const LIFE_AREAS = [
  "school",
  "home",
  "work",
  "money",
  "health",
  "personal",
  "other",
] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

/** Starting life areas for a new user; each user can customise their own set. */
export const DEFAULT_LIFE_AREAS: string[] = [...LIFE_AREAS];

export const TASK_STATUSES = [
  "review",
  "active",
  "done",
  "paid",
  "dismissed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
