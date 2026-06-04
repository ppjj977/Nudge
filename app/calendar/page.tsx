import { DateTime } from "luxon";
import Link from "next/link";
import { getOrCreateDefaultUser, getUserLifeAreas } from "@/lib/users";
import { getActiveTasks } from "@/lib/tasks";
import { ACTION_CATEGORIES } from "@/lib/categories";
import CalendarMonth, { type CalDay } from "../CalendarMonth";
import type { TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

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

  const tasks = await getActiveTasks(user.id);
  const byDay = new Map<string, TaskView[]>();
  for (const t of tasks) {
    if (!t.due_at || t.due_type === "none") continue;
    const d = DateTime.fromISO(t.due_at, { zone: tz });
    if (!d.isValid) continue;
    const key = d.toFormat("yyyy-LL-dd");
    const arr = byDay.get(key) ?? [];
    arr.push(t as unknown as TaskView);
    byDay.set(key, arr);
  }

  const days: CalDay[] = Array.from({ length: 42 }, (_, i) => {
    const day = gridStart.plus({ days: i });
    const key = day.toFormat("yyyy-LL-dd");
    return {
      key,
      day: day.day,
      out: day.month !== monthStart.month,
      today: key === todayKey,
      tasks: byDay.get(key) ?? [],
    };
  });

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Calendar</h1>
      </div>

      <div className="cal-head">
        <Link
          className="cal-nav"
          href={`/calendar?m=${monthStart.minus({ months: 1 }).toFormat("yyyy-LL")}`}
        >
          ‹
        </Link>
        <strong>{monthStart.toFormat("LLLL yyyy")}</strong>
        <Link
          className="cal-nav"
          href={`/calendar?m=${monthStart.plus({ months: 1 }).toFormat("yyyy-LL")}`}
        >
          ›
        </Link>
      </div>

      <CalendarMonth
        days={days}
        lifeAreas={getUserLifeAreas(user)}
        categories={[...ACTION_CATEGORIES]}
        initialSelected={
          days.some((d) => d.today && !d.out) ? todayKey : null
        }
      />
    </>
  );
}
