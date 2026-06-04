import { DateTime } from "luxon";
import Link from "next/link";
import { getOrCreateDefaultUser } from "@/lib/users";
import { getActiveTasks, type Task } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  pay: "💷",
  book: "📅",
  attend: "📍",
  prepare: "🎒",
  send: "✉️",
  renew: "🔁",
  reminder: "⏰",
  fyi: "📄",
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await getOrCreateDefaultUser();
  const tz = user.timezone;
  const now = DateTime.now().setZone(tz);
  const { m } = await searchParams;

  const month =
    m && /^\d{4}-\d{2}$/.test(m)
      ? DateTime.fromFormat(m, "yyyy-LL", { zone: tz })
      : now;
  const monthStart = month.startOf("month");
  const gridStart = monthStart.startOf("week"); // Monday
  const todayKey = now.toFormat("yyyy-LL-dd");

  // Bucket dated active tasks by day.
  const tasks = await getActiveTasks(user.id);
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_at || t.due_type === "none") continue;
    const d = DateTime.fromISO(t.due_at, { zone: tz });
    if (!d.isValid) continue;
    const key = d.toFormat("yyyy-LL-dd");
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }

  const cells = Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
  const prev = monthStart.minus({ months: 1 }).toFormat("yyyy-LL");
  const next = monthStart.plus({ months: 1 }).toFormat("yyyy-LL");

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Calendar</h1>
      </div>

      <div className="cal-head">
        <Link className="cal-nav" href={`/calendar?m=${prev}`}>
          ‹
        </Link>
        <strong>{monthStart.toFormat("LLLL yyyy")}</strong>
        <Link className="cal-nav" href={`/calendar?m=${next}`}>
          ›
        </Link>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((day) => {
          const key = day.toFormat("yyyy-LL-dd");
          const items = byDay.get(key) ?? [];
          const outOfMonth = day.month !== monthStart.month;
          return (
            <div
              key={key}
              className={`cal-cell ${outOfMonth ? "out" : ""} ${
                key === todayKey ? "today" : ""
              }`}
            >
              <div className="cal-date">{day.day}</div>
              {items.slice(0, 3).map((t) => (
                <span key={t.id} className="cal-pill" title={t.title}>
                  {ICON[t.category] ?? "•"} {t.title}
                </span>
              ))}
              {items.length > 3 && (
                <span className="cal-more">+{items.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 16 }}>
        Shows tasks with a date. Undated tasks live on your{" "}
        <Link href="/">timeline</Link>.
      </p>
    </>
  );
}
