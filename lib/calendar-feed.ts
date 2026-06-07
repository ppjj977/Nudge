import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { db, ensureSchema } from "./db";
import { config } from "./config";
import type { User } from "./users";
import type { Task } from "./tasks";

/**
 * Read-only iCalendar (.ics) feed of a user's dated tasks, so they can
 * subscribe to Nudge inside Google/Apple/Outlook calendars. Auth is a per-user
 * secret token in the URL (calendar apps can't send cookies), so the feed URL
 * is unguessable rather than session-protected.
 */

/** The user's calendar-feed token, generated on first use. */
export async function ensureCalendarToken(
  user: Pick<User, "id" | "calendar_token">,
): Promise<string> {
  await ensureSchema();
  if (user.calendar_token) return user.calendar_token;
  const token = randomBytes(16).toString("hex");
  await db.execute({
    sql: "UPDATE users SET calendar_token = ? WHERE id = ?",
    args: [token, user.id],
  });
  return token;
}

export async function findUserByCalendarToken(token: string): Promise<User | null> {
  await ensureSchema();
  if (!token || token.length < 16) return null;
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE calendar_token = ? LIMIT 1",
    args: [token],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

/** Subscribe URL (webcal:// so tapping it offers to add to the calendar). */
export function calendarFeedUrl(token: string, scheme: "https" | "webcal" = "webcal"): string {
  const base = (config.appBaseUrl ?? "https://nudgelive.co.uk").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${scheme}://${base}/api/calendar/${token}.ics`;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold long lines to 75 octets per RFC 5545 (be polite to strict parsers). */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    out.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return out.join("\r\n");
}

function stampUtc(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

export function buildIcsFeed(user: User, tasks: Task[]): string {
  const zone = user.timezone || "Europe/London";
  const now = DateTime.now();
  const domain = (config.appBaseUrl ?? "nudgelive.co.uk").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nudge//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Nudge",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const t of tasks) {
    if (!t.due_at || t.due_type === "none") continue;
    const start = DateTime.fromISO(t.due_at, { zone });
    if (!start.isValid) continue;

    const ev: string[] = ["BEGIN:VEVENT", `UID:${t.id}@${domain}`, `DTSTAMP:${stampUtc(now)}`];

    if (t.due_type === "datetime") {
      const mins = t.estimate_minutes && t.estimate_minutes > 0 ? t.estimate_minutes : 30;
      ev.push(`DTSTART:${stampUtc(start)}`);
      ev.push(`DTEND:${stampUtc(start.plus({ minutes: mins }))}`);
    } else {
      // All-day. DTEND is exclusive, so add a day (or use end_at for spans).
      const endDay = t.end_at ? DateTime.fromISO(t.end_at, { zone }) : start;
      ev.push(`DTSTART;VALUE=DATE:${start.toFormat("yyyyMMdd")}`);
      ev.push(`DTEND;VALUE=DATE:${endDay.plus({ days: 1 }).toFormat("yyyyMMdd")}`);
    }

    const icons: Record<string, string> = { pay: "💷", attend: "📍", celebrate: "🎂" };
    const icon = icons[t.category] ?? "";
    ev.push(`SUMMARY:${esc(`${icon ? icon + " " : ""}${t.title}`)}`);
    const descBits = [t.detail, t.amount != null ? `Amount: ${t.currency ?? "GBP"} ${t.amount}` : null]
      .filter(Boolean)
      .join("\n");
    if (descBits) ev.push(`DESCRIPTION:${esc(descBits)}`);
    if (t.location) ev.push(`LOCATION:${esc(t.location)}`);
    ev.push(`CATEGORIES:${esc(t.category)}`);
    ev.push("END:VEVENT");
    lines.push(...ev);
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
