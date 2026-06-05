import { DateTime } from "luxon";

/**
 * Repeating tasks. A recurrence is anchored to the task's due date and repeats
 * every `interval` units of `freq`. Completing a recurring task spawns the next
 * occurrence (see lib/tasks.ts). This covers the life-admin staples: bins
 * (weekly), council tax (monthly), birthdays/MOT (yearly), meds (daily).
 */
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Repeat every N units of `freq` (>= 1). */
  interval: number;
}

const FREQS: readonly RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

/** Validate/normalize an unknown value into a Recurrence, or null. */
export function parseRecurrence(raw: unknown): Recurrence | null {
  let v = raw;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      v = JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const r = v as Partial<Recurrence>;
  if (!FREQS.includes(r.freq as RecurrenceFreq)) return null;
  const interval =
    typeof r.interval === "number" && Number.isFinite(r.interval)
      ? Math.max(1, Math.trunc(r.interval))
      : 1;
  return { freq: r.freq as RecurrenceFreq, interval };
}

const UNIT: Record<RecurrenceFreq, "days" | "weeks" | "months" | "years"> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

/**
 * Advance an ISO date/datetime by one recurrence step. Preserves the time and
 * (for date-only values) the date format. Returns null for an unparseable date.
 */
export function advance(iso: string, rec: Recurrence): string | null {
  const dateOnly = !iso.includes("T");
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  if (!dt.isValid) return null;
  const next = dt.plus({ [UNIT[rec.freq]]: rec.interval });
  return dateOnly ? next.toFormat("yyyy-LL-dd") : next.toISO();
}

/** Human-friendly label, e.g. "Every week", "Every 2 months", "Yearly". */
export function describeRecurrence(rec: Recurrence): string {
  const noun = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[
    rec.freq
  ];
  if (rec.interval === 1) {
    return rec.freq === "daily" ? "Daily" : rec.freq === "yearly" ? "Yearly" : `Every ${noun}`;
  }
  return `Every ${rec.interval} ${noun}s`;
}
