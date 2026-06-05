import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { ensureSchema } from "./db";
import { getTaskByIdAny, getTimeline, type Task } from "./tasks";
import { getUserById, getAllUsers } from "./users";
import { parseUserSettings } from "./reminders";
import { sendEmail, esc, emailShell, emailBrand } from "./email";
import { sendPushToUser } from "./push";
import { sendFcmToUser } from "./fcm";
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
  if (task.household_id) textLines.push("(shared with your family)");
  if (due) textLines.push(`Due: ${due}`);
  if (task.location) textLines.push(`Where: ${task.location}`);
  if (task.amount != null)
    textLines.push(`Amount: ${task.currency ?? "GBP"} ${task.amount}`);
  if (task.detail) textLines.push("", task.detail);
  if (task.source_excerpt) textLines.push("", `From: "${task.source_excerpt}"`);
  if (pending.length) {
    textLines.push("", "Checklist:");
    pending.forEach((c) => textLines.push(`☐ ${c.text}`));
  }
  textLines.push("", "Open nudge to mark it done or snooze it for later.");
  if (link) textLines.push("", link);

  const meta = (label: string, value: string) =>
    `<div style="color:${emailBrand.muted};font-size:14px;margin-top:2px">${label}: ${value}</div>`;
  const checklistHtml = pending.length
    ? `<ul style="margin:12px 0 0;padding-left:18px;color:${emailBrand.text}">${pending
        .map((c) => `<li>${esc(c.text)}</li>`)
        .join("")}</ul>`
    : "";
  const familyHtml = task.household_id
    ? `<div style="display:inline-block;margin:0 0 10px;padding:3px 10px;border-radius:999px;background:${emailBrand.mint};color:#2f5a45;font-size:12px;font-weight:700">👪 Shared with your family</div>`
    : "";
  const excerptHtml = task.source_excerpt
    ? `<blockquote style="border-left:3px solid ${emailBrand.mint};margin:14px 0 0;padding:2px 0 2px 12px;color:${emailBrand.muted};font-style:italic">“${esc(task.source_excerpt)}”</blockquote>`
    : "";

  const bodyHtml = `
    ${familyHtml}
    ${due ? meta("Due", esc(due)) : ""}
    ${task.location ? meta("Where", esc(task.location)) : ""}
    ${task.amount != null ? meta("Amount", `${esc(task.currency ?? "GBP")} ${task.amount}`) : ""}
    ${task.detail ? `<p style="color:${emailBrand.text};margin:12px 0 0">${esc(task.detail)}</p>` : ""}
    ${excerptHtml}
    ${checklistHtml}
    <p style="color:${emailBrand.muted};font-size:13px;margin:16px 0 0">Open nudge to mark it done or snooze it for later.</p>`;

  const html = emailShell({
    heading: `⏰ ${esc(task.title)}`,
    bodyHtml,
    ctaText: link ? "Open nudge" : undefined,
    ctaUrl: link,
  });

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

/**
 * How far ahead each tick looks for reminders. Set to the cron cadence so a
 * reminder due any time before the next tick is sent on this one — i.e. it
 * arrives at or slightly before its due time, never after. Keep this in sync
 * with the schedule in .github/workflows/cron.yml (currently every 5 minutes).
 */
const DISPATCH_LOOKAHEAD_MINUTES = 5;

export async function runDispatch(
  now: DateTime = DateTime.now(),
): Promise<DispatchResult> {
  await ensureSchema();
  // Include anything due before the next tick so timed nudges fire early, not late.
  const windowEnd = now
    .plus({ minutes: DISPATCH_LOOKAHEAD_MINUTES })
    .toUTC()
    .toISO();
  const res = await db.execute({
    sql: `SELECT id, task_id, user_id, fire_at, status FROM reminders
          WHERE status = 'pending' AND fire_at <= ?
          ORDER BY fire_at ASC LIMIT 500`,
    args: [windowEnd],
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
      const payload = {
        title: `⏰ ${task.title}`,
        body: task.detail ?? "Tap to open nudge",
        url: config.appBaseUrl,
      };
      await sendPushToUser(user.id, payload); // web push (PWA / desktop)
      await sendFcmToUser(user.id, payload); // native push (Android app)
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
