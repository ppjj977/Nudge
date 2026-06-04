import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { ensureSchema } from "./db";
import { getTaskByIdAny, getTimeline, type Task } from "./tasks";
import { getUserById, getAllUsers } from "./users";
import { parseUserSettings } from "./reminders";
import { sendEmail, esc } from "./email";
import { sendPushToUser } from "./push";
import { composeDigest } from "./digest";
import { config } from "./config";

/* -------------------------------------------------------------------------- */
/* Reminder dispatcher (SPEC §4). Fire due, still-pending reminders.           */
/* -------------------------------------------------------------------------- */

interface ReminderRow {
  id: string;
  task_id: string;
  user_id: string;
  fire_at: string;
  status: string;
}

function reminderEmail(task: Task, tz: string) {
  const due =
    task.due_at && task.due_type !== "none"
      ? DateTime.fromISO(task.due_at, { zone: tz }).toFormat(
          task.due_type === "datetime" ? "cccc d LLLL, HH:mm" : "cccc d LLLL",
        )
      : null;

  const pending = (task.checklist ?? []).filter((c) => !c.done);
  const link = config.appBaseUrl;

  const textLines = [task.title];
  if (due) textLines.push(`Due: ${due}`);
  if (task.location) textLines.push(`Where: ${task.location}`);
  if (task.amount != null)
    textLines.push(`Amount: ${task.currency ?? "GBP"} ${task.amount}`);
  if (task.detail) textLines.push("", task.detail);
  if (pending.length) {
    textLines.push("", "Checklist:");
    pending.forEach((c) => textLines.push(`☐ ${c.text}`));
  }
  if (link) textLines.push("", link);

  const checklistHtml = pending.length
    ? `<ul>${pending.map((c) => `<li>☐ ${esc(c.text)}</li>`).join("")}</ul>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 8px">⏰ ${esc(task.title)}</h2>
    ${due ? `<div style="color:#555">Due: ${esc(due)}</div>` : ""}
    ${task.location ? `<div style="color:#555">Where: ${esc(task.location)}</div>` : ""}
    ${task.amount != null ? `<div style="color:#555">Amount: ${esc(task.currency ?? "GBP")} ${task.amount}</div>` : ""}
    ${task.detail ? `<p>${esc(task.detail)}</p>` : ""}
    ${checklistHtml}
    ${link ? `<p style="margin-top:18px"><a href="${esc(link)}">Open nudge →</a></p>` : ""}
  </div>`;

  return {
    subject: `⏰ ${task.title}`,
    text: textLines.join("\n"),
    html,
  };
}

export interface DispatchResult {
  due: number;
  sent: number;
  cancelled: number;
}

export async function runDispatch(
  now: DateTime = DateTime.now(),
): Promise<DispatchResult> {
  await ensureSchema();
  const nowIso = now.toUTC().toISO();
  const res = await db.execute({
    sql: `SELECT id, task_id, user_id, fire_at, status FROM reminders
          WHERE status = 'pending' AND fire_at <= ?
          ORDER BY fire_at ASC LIMIT 500`,
    args: [nowIso],
  });
  const rows = res.rows as unknown as ReminderRow[];

  let sent = 0;
  let cancelled = 0;
  for (const r of rows) {
    const task = await getTaskByIdAny(r.task_id);
    // If the task is gone or no longer active, the reminder is stale.
    if (!task || task.status !== "active") {
      await markReminder(r.id, "cancelled");
      cancelled++;
      continue;
    }
    const user = await getUserById(r.user_id);
    if (!user) {
      await markReminder(r.id, "cancelled");
      cancelled++;
      continue;
    }

    const { channels } = parseUserSettings(user);
    if (channels.email && user.email) {
      const msg = reminderEmail(task, user.timezone);
      await sendEmail({ to: user.email, ...msg });
    }
    if (channels.push) {
      await sendPushToUser(user.id, {
        title: `⏰ ${task.title}`,
        body: task.detail ?? "Tap to open nudge",
        url: config.appBaseUrl,
      });
    }
    await markReminder(r.id, "sent", now.toUTC().toISO());
    sent++;
  }
  return { due: rows.length, sent, cancelled };
}

async function markReminder(id: string, status: string, sentAt?: string | null) {
  await db.execute({
    sql: "UPDATE reminders SET status = ?, sent_at = ? WHERE id = ?",
    args: [status, sentAt ?? null, id],
  });
}

/* -------------------------------------------------------------------------- */
/* Daily digest (SPEC §9). Hourly; sends to users at their local digest hour.  */
/* -------------------------------------------------------------------------- */

export interface DigestResult {
  considered: number;
  sent: number;
}

export async function runDigest(
  now: DateTime = DateTime.now(),
): Promise<DigestResult> {
  await ensureSchema();
  const users = await getAllUsers();
  let sent = 0;

  for (const user of users) {
    const local = now.setZone(user.timezone);
    if (local.hour !== user.digest_hour) continue;

    const sentFor = local.toFormat("yyyy-LL-dd");
    const already = await db.execute({
      sql: "SELECT 1 FROM digest_log WHERE user_id = ? AND sent_for = ? LIMIT 1",
      args: [user.id, sentFor],
    });
    if (already.rows.length > 0) continue;

    const timeline = await getTimeline(user.id, user.timezone);
    const composed = composeDigest(user, timeline, local);

    // Record the log even when empty so we don't re-check this user all hour.
    await db.execute({
      sql: "INSERT INTO digest_log (id, user_id, sent_for, sent_at) VALUES (?,?,?,?)",
      args: [newId("dig"), user.id, sentFor, now.toUTC().toISO()],
    });

    if (composed) {
      const { channels } = parseUserSettings(user);
      if (channels.email && user.email) {
        await sendEmail({ to: user.email, ...composed });
        sent++;
      }
    }
  }
  return { considered: users.length, sent };
}
