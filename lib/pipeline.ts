import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { extract, ExtractionParseError } from "./extract";
import { insertTasksFromExtraction, type Task } from "./tasks";
import { tidyText } from "./normalize";
import { getUserLifeAreas, type User } from "./users";
import { captureAllowance } from "./plan";

/**
 * The one extraction path (SPEC §6): a capture's normalized text -> Groq ->
 * tasks. Every ingest endpoint builds a capture row and calls this, so there
 * is a single place where extraction failures are handled and logged.
 */
export interface IngestInput {
  source: "email" | "text" | "image" | "audio";
  /** Original payload kept for audit (purged per retention). */
  rawContent: string;
  /** Plain text fed to the extractor. */
  normalizedText: string;
  /** Extra context recorded on the capture (sender, subject, ocr confidence). */
  meta?: Record<string, unknown>;
}

export interface IngestResult {
  captureId: string;
  status: "processed" | "failed" | "limit";
  nothingActionable: boolean;
  tasks: Task[];
  error?: string;
  limit?: { used: number; limit: number };
}

export async function ingestAndExtract(
  user: User,
  input: IngestInput,
): Promise<IngestResult> {
  // Free-plan monthly cap on AI captures (the cost driver). Blocks before we
  // spend on extraction; Pro is unlimited. Manual task entry is never capped.
  const allow = await captureAllowance(user);
  if (!allow.allowed) {
    return {
      captureId: "",
      status: "limit",
      nothingActionable: false,
      tasks: [],
      limit: { used: allow.used, limit: allow.limit },
    };
  }

  const captureId = newId("cap");
  const receivedAt = new Date().toISOString();
  const normalized = tidyText(input.normalizedText);

  await db.execute({
    sql: `INSERT INTO captures
            (id, user_id, source, raw_content, normalized_text, received_at, status, meta)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [
      captureId,
      user.id,
      input.source,
      input.rawContent,
      normalized,
      receivedAt,
      "pending",
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  });

  // Nothing to extract from (e.g. OCR produced no text).
  if (normalized.trim().length === 0) {
    await setCaptureStatus(captureId, "processed");
    return {
      captureId,
      status: "processed",
      nothingActionable: true,
      tasks: [],
    };
  }

  try {
    const result = await extract(normalized, {
      timezone: user.timezone,
      lifeAreas: getUserLifeAreas(user),
      now: DateTime.now().setZone(user.timezone),
    });
    const tasks = await insertTasksFromExtraction(user.id, captureId, result);
    await setCaptureStatus(captureId, "processed");
    return {
      captureId,
      status: "processed",
      nothingActionable: result.nothing_actionable,
      tasks,
    };
  } catch (err) {
    // On parse/validation failure, mark failed and log — do not crash (SPEC §7).
    const message =
      err instanceof ExtractionParseError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    await setCaptureStatus(captureId, "failed", message);
    console.error(`[pipeline] capture ${captureId} extraction failed:`, message);
    return {
      captureId,
      status: "failed",
      nothingActionable: false,
      tasks: [],
      error: message,
    };
  }
}

async function setCaptureStatus(
  captureId: string,
  status: "processed" | "failed",
  error?: string,
): Promise<void> {
  if (error) {
    await db.execute({
      sql: `UPDATE captures
            SET status = ?, meta = json_set(COALESCE(meta,'{}'), '$.error', ?)
            WHERE id = ?`,
      args: [status, error, captureId],
    });
  } else {
    await db.execute({
      sql: "UPDATE captures SET status = ? WHERE id = ?",
      args: [status, captureId],
    });
  }
}
