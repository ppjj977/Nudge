import { DateTime } from "luxon";
import { config } from "./config";
import { esc, emailShell, emailBrand } from "./email";
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
      ? ` <span style="color:${emailBrand.muted}">— ${esc(task.currency ?? "GBP")} ${task.amount}</span>`
      : "";
  return `<li style="margin:4px 0;color:${emailBrand.text}"><strong>${esc(task.title)}</strong>${
    due ? ` <span style="color:${emailBrand.muted}">(${esc(due)})</span>` : ""
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
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;
  const greet = now.hour < 12 ? "Good morning" : now.hour < 18 ? "Good afternoon" : "Good evening";

  // A warm, human one-liner summarising the day.
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  let summary: string;
  if (today.length > 0) {
    summary = `You've got ${plural(today.length, "thing")} for today`;
    if (week.length) summary += ` and ${plural(week.length, "more")} coming up this week`;
    summary += ".";
  } else if (week.length > 0) {
    summary = `Nothing pressing today — ${plural(week.length, "thing")} on the way this week.`;
  } else {
    summary = "Just a couple of things to glance over.";
  }

  // --- text ---
  const opener = `${greet}${firstName ? `, ${firstName}` : ""} — ${summary}`;
  const textParts: string[] = [opener, dateStr, ""];
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
      ? `<h3 style="margin:18px 0 6px;font-size:12px;letter-spacing:1px;color:${emailBrand.green};text-transform:uppercase">${title}</h3><ul style="margin:0;padding-left:18px">${tasks
          .map((t) => lineHtml(t, tz))
          .join("")}</ul>`
      : "";

  const reviewHtml = review.length
    ? `<p style="margin-top:18px;padding:10px 14px;background:rgba(245,181,46,0.16);border:1px solid ${emailBrand.amber};border-radius:10px;color:#6b4e00;font-weight:600">${review.length} item${
        review.length === 1 ? "" : "s"
      } need a quick review.</p>`
    : "";

  const html = emailShell({
    heading: `${greet}${firstName ? `, ${esc(firstName)}` : ""}`,
    intro: esc(summary),
    bodyHtml: `<div style="color:${emailBrand.muted};font-size:13px;margin:0 0 4px">${esc(dateStr)}</div>${section("Today", today)}${section("This week", week)}${reviewHtml}`,
    ctaText: link ? "Open nudge" : undefined,
    ctaUrl: link,
  });

  const count = today.length + week.length;
  const subject =
    today.length > 0
      ? `nudge: ${today.length} due today${week.length ? ` · ${week.length} this week` : ""}`
      : `nudge: ${count} coming up`;

  return { subject, html, text: textParts.join("\n") };
}
