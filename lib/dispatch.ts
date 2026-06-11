import { DateTime } from "luxon";
import { db } from "./db";
import { newId } from "./ids";
import { ensureSchema } from "./db";
import { getTaskByIdAny, getTimeline, type Task } from "./tasks";
import { getUserById, getAllUsers } from "./users";
import { parseUserSettings } from "./reminders";
import { isPro } from "./plan";
import { sendEmail, esc, emailShell, emailBrand } from "./email";
import { sendPushToUser } from "./push";
import { sendFcmToUser } from "./fcm";
import { composeDigest } from "./digest";
import { purgeExpiredRawCaptures } from "./captures";
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
  kind?: string;
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
  purged?: number;
}

/**
 * Human "when it's due" line for a reminder, relative to `now` (both in the
 * user's timezone): "Due now", "Due today at 09:00", "Due tomorrow at 09:00",
 * "Due Fri 12 Jun at 09:00", or date-only variants. Used as the push body so
 * every reminder says when the thing is actually due.
 */
function duePhrase(task: Task, now: DateTime, tz: string): string {
  if (!task.due_at || task.due_type === "none") return "Tap to open nudge";
  const due = DateTime.fromISO(task.due_at, { zone: tz });
  if (!due.isValid) return "Tap to open nudge";
  const hasTime = task.due_type === "datetime";
  const time = due.toFormat("HH:mm");
  if (hasTime && due <= now.plus({ minutes: 2 })) return "Due now";
  const dayDiff = Math.round(due.startOf("day").diff(now.startOf("day"), "days").days);
  if (dayDiff < 0) return hasTime ? `Overdue — was due ${time}` : "Overdue";
  if (dayDiff === 0) return hasTime ? `Due today at ${time}` : "Due today";
  if (dayDiff === 1) return hasTime ? `Due tomorrow at ${time}` : "Due tomorrow";
  const datestr = due.toFormat("ccc d LLL");
  return hasTime ? `Due ${datestr} at ${time}` : `Due ${datestr}`;
}

/**
 * How far ahead each tick looks for reminders. Set to the (primary) cron
 * cadence so a reminder due any time before the next tick is sent on this one —
 * i.e. it arrives at or slightly before its due time, never after. The primary
 * scheduler is cron-job.org running every minute, so 1 minute keeps reminders
 * within ~60s of their exact time.
 */
const DISPATCH_LOOKAHEAD_MINUTES = 1;

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
    sql: `SELECT id, task_id, user_id, fire_at, status, kind FROM reminders
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

    // Atomically claim the reminder before sending so two overlapping dispatch
    // runs (e.g. the every-minute cron-job.org tick and the GitHub backup) can
    // never both send it: only the run whose UPDATE flips pending->sent wins.
    if (!(await claimReminder(r.id, now))) continue;

    try {
      const { channels } = parseUserSettings(user);
      // Email reminders are a Pro feature; free users get push only.
      if (channels.email && user.email && isPro(user)) {
        const msg = reminderEmail(task, user.timezone);
        await sendEmail({ to: user.email, ...msg });
      }
      if (channels.push) {
        const nowTz = now.setZone(user.timezone);
        const payload = {
          title: `⏰ ${task.title}`,
          body: duePhrase(task, nowTz, user.timezone),
          // Relative path: the tap stays inside the app/PWA origin. An absolute
          // URL (esp. the raw Render host) would open the system browser instead.
          url: "/",
          taskId: task.id,
          doneStatus: task.category === "pay" ? "paid" : "done",
        };
        await sendPushToUser(user.id, payload); // web push (PWA / desktop)
        await sendFcmToUser(user.id, payload); // native push (Android app)
      }
      sent++;
    } catch (err) {
      // Delivery failed after claiming — return it to pending so a later tick
      // retries, then surface the error.
      await markReminder(r.id, "pending", null);
      throw err;
    }
  }
  // Drop raw capture payloads past the retention window (Data Safety promise).
  const purged = await purgeExpiredRawCaptures(now.toJSDate());
  return { due: rows.length, sent, cancelled, purged };
}

/**
 * Claim a pending reminder for this run by flipping it to 'sent' atomically.
 * Returns true only if this run actually claimed it (rowsAffected === 1); a
 * concurrent run that already claimed it yields false, so we skip it.
 */
async function claimReminder(id: string, now: DateTime): Promise<boolean> {
  const res = await db.execute({
    sql: "UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ? AND status = 'pending'",
    args: [now.toUTC().toISO(), id],
  });
  return res.rowsAffected === 1;
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

    // The digest is its own opt-in (default on); email is Pro-only.
    const { digest } = parseUserSettings(user);
    if (!digest || !user.email || !isPro(user)) continue;

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
      await sendEmail({ to: user.email, ...composed });
      sent++;
    }
  }
  return { considered: users.length, sent };
}
