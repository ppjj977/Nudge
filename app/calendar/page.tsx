import { DateTime } from "luxon";
import Link from "next/link";
import { getUserLifeAreas } from "@/lib/users";
import { requireUser } from "@/lib/auth";
import { getActiveTasks } from "@/lib/tasks";
import { getMembershipForUser } from "@/lib/households";
import { ACTION_CATEGORIES } from "@/lib/categories";
import CalendarMonth, { type CalDay } from "../CalendarMonth";
import CalendarWeek from "../CalendarWeek";
import type { TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string; w?: string }>;
}) {
  const user = await requireUser();
  const tz = user.timezone;
  const now = DateTime.now().setZone(tz);
  const { m, view: viewParam, w } = await searchParams;
  const view = viewParam === "week" ? "week" : "month";

  const month =
    m && /^\d{4}-\d{2}$/.test(m)
      ? DateTime.fromFormat(m, "yyyy-LL", { zone: tz })
      : now;
  const monthStart = month.startOf("month");
  // Week view pivots on ?w=yyyy-MM-dd (any day in the week), else today.
  const weekRef =
    w && /^\d{4}-\d{2}-\d{2}$/.test(w)
      ? DateTime.fromFormat(w, "yyyy-LL-dd", { zone: tz })
      : now;
  const gridStart = (view === "week" ? weekRef : monthStart).startOf("week"); // Monday
  const cellCount = view === "week" ? 7 : 42;
  const todayKey = now.toFormat("yyyy-LL-dd");

  // Include tasks shared with the user's family so they show on the calendar.
  const membership = await getMembershipForUser(user.id);
  const tasks = await getActiveTasks(user.id, { householdId: membership?.household.id });
  const byDay = new Map<string, TaskView[]>();
  const place = (key: string, t: TaskView) => {
    const arr = byDay.get(key) ?? [];
    arr.push(t);
    byDay.set(key, arr);
  };
  for (const t of tasks) {
    if (!t.due_at || t.due_type === "none") continue;
    const start = DateTime.fromISO(t.due_at, { zone: tz });
    if (!start.isValid) continue;
    const tv = t as unknown as TaskView;
    // Multi-day spans block every day from start to end (inclusive, capped).
    const end =
      t.end_at && DateTime.fromISO(t.end_at, { zone: tz }).isValid
        ? DateTime.fromISO(t.end_at, { zone: tz })
        : start;
    let cursor = start.startOf("day");
    const last = end.startOf("day");
    for (let i = 0; i < 90 && cursor <= last; i++) {
      place(cursor.toFormat("yyyy-LL-dd"), tv);
      cursor = cursor.plus({ days: 1 });
    }
  }

  const days: CalDay[] = Array.from({ length: cellCount }, (_, i) => {
    const day = gridStart.plus({ days: i });
    const key = day.toFormat("yyyy-LL-dd");
    return {
      key,
      day: day.day,
      out: view === "month" && day.month !== monthStart.month,
      today: key === todayKey,
      tasks: byDay.get(key) ?? [],
    };
  });

  const weekEnd = gridStart.plus({ days: 6 });
  const monthHref = `/calendar?m=${monthStart.toFormat("yyyy-LL")}`;
  const weekHref = `/calendar?view=week&w=${gridStart.toFormat("yyyy-LL-dd")}`;

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Calendar</h1>
      </div>

      <div className="cal-toggle">
        <Link className={`cal-toggle-btn ${view === "month" ? "active" : ""}`} href={monthHref}>
          Month
        </Link>
        <Link className={`cal-toggle-btn ${view === "week" ? "active" : ""}`} href={weekHref}>
          Week
        </Link>
      </div>

      <div className="cal-head">
        {view === "month" ? (
          <>
            <Link className="cal-nav" href={`/calendar?m=${monthStart.minus({ months: 1 }).toFormat("yyyy-LL")}`}>
              ‹
            </Link>
            <strong>{monthStart.toFormat("LLLL yyyy")}</strong>
            <Link className="cal-nav" href={`/calendar?m=${monthStart.plus({ months: 1 }).toFormat("yyyy-LL")}`}>
              ›
            </Link>
          </>
        ) : (
          <>
            <Link className="cal-nav" href={`/calendar?view=week&w=${gridStart.minus({ weeks: 1 }).toFormat("yyyy-LL-dd")}`}>
              ‹
            </Link>
            <strong>
              {gridStart.toFormat("d LLL")} – {weekEnd.toFormat("d LLL")}
            </strong>
            <Link className="cal-nav" href={`/calendar?view=week&w=${gridStart.plus({ weeks: 1 }).toFormat("yyyy-LL-dd")}`}>
              ›
            </Link>
          </>
        )}
      </div>

      {view === "week" ? (
        <CalendarWeek days={days} />
      ) : (
        <CalendarMonth
          days={days}
          lifeAreas={getUserLifeAreas(user)}
          categories={[...ACTION_CATEGORIES]}
          initialSelected={days.some((d) => d.today && !d.out) ? todayKey : null}
        />
      )}
    </>
  );
}
