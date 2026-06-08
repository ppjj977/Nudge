import { db, ensureSchema } from "./db";

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
