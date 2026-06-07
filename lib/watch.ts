import Groq from "groq-sdk";
import { z } from "zod";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { requireGroq } from "./config";
import { sendPushToUser } from "./push";
import { sendFcmToUser } from "./fcm";
import { isPro } from "./plan";
import { getUserById } from "./users";

/**
 * Conditional "watch → notify" reminders. A watch stores a URL plus a
 * natural-language condition; a cron job periodically fetches the page and asks
 * the model whether the condition is now true, firing a push once it is.
 *
 * Cost note: each check is a fetch + an LLM call, so free users get a small cap
 * (the cost driver), Pro gets more.
 */
export const FREE_WATCH_LIMIT = 2;
export const PRO_WATCH_LIMIT = 25;

export interface Watch {
  id: string;
  user_id: string;
  url: string;
  condition: string;
  label: string | null;
  status: "active" | "met" | "paused";
  last_checked: string | null;
  last_note: string | null;
  created_at: string;
}

export async function listWatches(userId: string): Promise<Watch[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM watches WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return res.rows as unknown as Watch[];
}

export type CreateResult =
  | { ok: true; watch: Watch }
  | { ok: false; reason: "invalid_url" | "limit" };

export async function createWatch(
  userId: string,
  input: { url: string; condition: string; label?: string | null },
): Promise<CreateResult> {
  await ensureSchema();
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "invalid_url" };
  }
  if (!input.condition.trim()) return { ok: false, reason: "invalid_url" };

  const user = await getUserById(userId);
  const limit = isPro(user) ? PRO_WATCH_LIMIT : FREE_WATCH_LIMIT;
  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM watches WHERE user_id = ? AND status != 'met'",
    args: [userId],
  });
  if (Number((countRes.rows[0] as { n?: number })?.n ?? 0) >= limit) {
    return { ok: false, reason: "limit" };
  }

  const id = newId("wch");
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO watches (id, user_id, url, condition, label, status, last_checked, last_note, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      userId,
      parsed.toString(),
      input.condition.trim(),
      input.label?.trim() || null,
      "active",
      null,
      null,
      now,
    ],
  });
  const watch = (await db.execute({
    sql: "SELECT * FROM watches WHERE id = ? LIMIT 1",
    args: [id],
  })).rows[0] as unknown as Watch;
  return { ok: true, watch };
}

export async function deleteWatch(userId: string, id: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "DELETE FROM watches WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

/* --------------------------- the checker ---------------------------------- */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; NudgeWatch/1.0; +https://nudgelive.co.uk)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return stripHtml(html).slice(0, 6000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const EvalSchema = z.object({
  met: z.boolean(),
  note: z.union([z.string(), z.null()]).optional(),
});

async function evaluateCondition(
  condition: string,
  pageText: string,
): Promise<{ met: boolean; note: string }> {
  const { apiKey, model } = requireGroq();
  const client = new Groq({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You check whether a condition about a web page is currently TRUE, using only the page text provided. " +
          'Respond ONLY as JSON: {"met": boolean, "note": "<short reason / observed value>"}. ' +
          "If the page text is insufficient to tell, met=false.",
      },
      { role: "user", content: `Condition: ${condition}\n\nPage text:\n${pageText}` },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const r = EvalSchema.safeParse(JSON.parse(raw));
    if (r.success) return { met: r.data.met, note: (r.data.note ?? "").slice(0, 280) };
  } catch {
    /* fall through */
  }
  return { met: false, note: "" };
}

export interface WatchRunResult {
  checked: number;
  met: number;
}

/** Re-check the oldest active watches; fire a push when a condition is met. */
export async function runWatchChecks(limit = 15): Promise<WatchRunResult> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM watches WHERE status = 'active'
          ORDER BY (last_checked IS NOT NULL), last_checked ASC
          LIMIT ?`,
    args: [limit],
  });
  const watches = res.rows as unknown as Watch[];
  let met = 0;

  for (const w of watches) {
    const now = new Date().toISOString();
    const text = await fetchPageText(w.url);
    if (text === null) {
      await db.execute({
        sql: "UPDATE watches SET last_checked = ?, last_note = ? WHERE id = ?",
        args: [now, "Couldn’t reach the page", w.id],
      });
      continue;
    }

    let result: { met: boolean; note: string };
    try {
      result = await evaluateCondition(w.condition, text);
    } catch {
      await db.execute({
        sql: "UPDATE watches SET last_checked = ? WHERE id = ?",
        args: [now, w.id],
      });
      continue;
    }

    if (result.met) {
      met++;
      await db.execute({
        sql: "UPDATE watches SET status = 'met', last_checked = ?, last_note = ? WHERE id = ?",
        args: [now, result.note || "Condition met", w.id],
      });
      const title = "🔔 Nudge watch";
      const body = `${w.label || w.condition}${result.note ? ` — ${result.note}` : " — condition met"}`;
      const payload = { title, body, url: "/watch" };
      await sendPushToUser(w.user_id, payload).catch(() => 0);
      await sendFcmToUser(w.user_id, payload).catch(() => 0);
    } else {
      await db.execute({
        sql: "UPDATE watches SET last_checked = ?, last_note = ? WHERE id = ?",
        args: [now, result.note || "Not yet", w.id],
      });
    }
  }

  return { checked: watches.length, met };
}
