import { DateTime } from "luxon";
import { config } from "./config";
import { esc } from "./email";
import type { Task, Timeline } from "./tasks";
import type { User } from "./users";

/**
 * Daily digest composition (SPEC §9): Today (due today + overdue), This week,
 * and a short Needs-review line. Plain and scannable — it competes with the
 * inbox it is trying to rescue the user from.
 */

function dueContext(task: Task, tz: string): string {
  if (!task.due_at || task.due_type === "none") return "";
  const d = DateTime.fromISO(task.due_at, { zone: tz });
  if (!d.isValid) return "";
  const label =
    task.due_type === "datetime"
      ? d.toFormat("ccc d LLL, HH:mm")
      : d.toFormat("ccc d LLL");
  return label;
}

function lineText(task: Task, tz: string): string {
  const bits = [task.title];
  const due = dueContext(task, tz);
  if (due) bits.push(`(${due})`);
  if (task.amount != null) bits.push(`— ${task.currency ?? "GBP"} ${task.amount}`);
  return bits.join(" ");
}

function lineHtml(task: Task, tz: string): string {
  const due = dueContext(task, tz);
  const amount =
    task.amount != null
      ? ` <span style="color:#888">— ${esc(task.currency ?? "GBP")} ${task.amount}</span>`
      : "";
  return `<li><strong>${esc(task.title)}</strong>${
    due ? ` <span style="color:#888">(${esc(due)})</span>` : ""
  }${amount}</li>`;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Returns null when there is nothing worth sending (SPEC §9 intent). */
export function composeDigest(
  user: User,
  timeline: Timeline,
  now: DateTime = DateTime.now().setZone(user.timezone),
): ComposedEmail | null {
  const { today, week, review } = timeline;
  if (today.length === 0 && week.length === 0 && review.length === 0) {
    return null;
  }

  const tz = user.timezone;
  const dateStr = now.toFormat("cccc d LLLL");
  const link = config.appBaseUrl;

  // --- text ---
  const textParts: string[] = [`nudge — ${dateStr}`, ""];
  if (today.length) {
    textParts.push("TODAY");
    today.forEach((t) => textParts.push(`• ${lineText(t, tz)}`));
    textParts.push("");
  }
  if (week.length) {
    textParts.push("THIS WEEK");
    week.forEach((t) => textParts.push(`• ${lineText(t, tz)}`));
    textParts.push("");
  }
  if (review.length) {
    textParts.push(
      `${review.length} item${review.length === 1 ? "" : "s"} need a quick review.`,
    );
  }
  if (link) textParts.push("", link);

  // --- html ---
  const section = (title: string, tasks: Task[]) =>
    tasks.length
      ? `<h3 style="margin:18px 0 6px;font-size:13px;letter-spacing:1px;color:#888;text-transform:uppercase">${title}</h3><ul style="margin:0;padding-left:18px">${tasks
          .map((t) => lineHtml(t, tz))
          .join("")}</ul>`
      : "";

  const reviewHtml = review.length
    ? `<p style="margin-top:18px;color:#b8860b">${review.length} item${
        review.length === 1 ? "" : "s"
      } need a quick review${link ? ` — <a href="${esc(link)}">open nudge</a>` : ""}.</p>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 2px">nudge</h2>
    <div style="color:#888;font-size:13px">${esc(dateStr)}</div>
    ${section("Today", today)}
    ${section("This week", week)}
    ${reviewHtml}
    ${link ? `<p style="margin-top:24px"><a href="${esc(link)}">Open nudge →</a></p>` : ""}
  </div>`;

  const count = today.length + week.length;
  const subject =
    today.length > 0
      ? `nudge: ${today.length} due today${week.length ? ` · ${week.length} this week` : ""}`
      : `nudge: ${count} coming up`;

  return { subject, html, text: textParts.join("\n") };
}
