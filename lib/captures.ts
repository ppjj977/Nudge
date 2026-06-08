import { db, ensureSchema } from "./db";
import { config } from "./config";

/**
 * Null out raw capture payloads (and the normalised text) once they're older
 * than the retention window. The extracted tasks remain; only the original
 * email/photo/voice text is dropped. This is what makes the Privacy Policy /
 * Data Safety promise ("raw captures are purged after a short retention
 * period") actually true. Driven from the dispatch cron.
 */
export async function purgeExpiredRawCaptures(now: Date = new Date()): Promise<number> {
  await ensureSchema();
  const days = config.retention.rawRetentionDays;
  if (!days || days <= 0) return 0;
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const res = await db.execute({
    sql: `UPDATE captures SET raw_content = NULL, normalized_text = NULL
          WHERE received_at < ? AND (raw_content IS NOT NULL OR normalized_text IS NOT NULL)`,
    args: [cutoff],
  });
  return res.rowsAffected ?? 0;
}

/**
 * Captures that produced no task ("nothing actionable" or a failed read). These
 * are surfaced in Recently added so an inbound email that didn't extract cleanly
 * isn't a silent failure — the user can still turn it into a task by hand.
 */
export interface EmptyCapture {
  id: string;
  source: string;
  status: string;
  subject: string | null;
  snippet: string;
  received_at: string;
}

function subjectOf(meta: string | null): string | null {
  if (!meta) return null;
  try {
    const m = JSON.parse(meta) as { subject?: string };
    return m.subject?.trim() || null;
  } catch {
    return null;
  }
}

export async function getRecentEmptyCaptures(
  userId: string,
  limit = 15,
): Promise<EmptyCapture[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT id, source, status, meta, normalized_text, received_at
          FROM captures c
          WHERE c.user_id = ? AND c.status IN ('processed', 'failed')
            AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.capture_id = c.id)
          ORDER BY c.received_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => {
    const row = r as unknown as {
      id: string;
      source: string;
      status: string;
      meta: string | null;
      normalized_text: string | null;
      received_at: string;
    };
    const subject = subjectOf(row.meta);
    const text = (row.normalized_text ?? "").replace(/\s+/g, " ").trim();
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      subject,
      snippet: (subject ? "" : text).slice(0, 160) || text.slice(0, 160),
      received_at: row.received_at,
    };
  });
}

/**
 * Dismiss an empty capture — the user confirming "no task needed". Flags it so
 * it drops out of getRecentEmptyCaptures (which only looks at processed/failed).
 */
export async function dismissCapture(userId: string, id: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE captures SET status = 'dismissed' WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}
