import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { getActiveTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const CATEGORY_ICON: Record<string, string> = {
  pay: "💷", book: "📅", attend: "📍", prepare: "🎒", send: "✉️",
  renew: "🔁", trip: "🧳", celebrate: "🎂", reminder: "⏰", fyi: "📄",
};

const DAY_START = 6; // 06:00
const DAY_END = 23; // 23:00
const PX_PER_MIN = 1.1; // vertical scale

/** A visual, hour-by-hour view of today — built for time-blindness. */
export default async function DayPage() {
  const user = await requireUser();
  const zone = user.timezone || "Europe/London";
  const now = DateTime.now().setZone(zone);
  const todayKey = now.toFormat("yyyy-LL-dd");

  const tasks = await getActiveTasks(user.id);
  const todays = tasks.filter((t) => {
    if (!t.due_at || t.due_type === "none") return false;
    return DateTime.fromISO(t.due_at, { zone }).toFormat("yyyy-LL-dd") === todayKey;
  });
  const timed = todays
    .filter((t) => t.due_type === "datetime")
    .map((t) => ({ t, dt: DateTime.fromISO(t.due_at!, { zone }) }))
    .sort((a, b) => a.dt.toMillis() - b.dt.toMillis());
  const allDay = todays.filter((t) => t.due_type !== "datetime");

  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
  const gridHeight = (DAY_END - DAY_START) * 60 * PX_PER_MIN + 40;
  const nowTop =
    now.hour >= DAY_START && now.hour <= DAY_END
      ? ((now.hour - DAY_START) * 60 + now.minute) * PX_PER_MIN
      : null;

  return (
    <div className="container">
      <div className="settings-head">
        <Link href="/" className="back">← Timeline</Link>
        <h1>Today · {now.toFormat("cccc d LLLL")}</h1>
      </div>

      {allDay.length > 0 && (
        <div className="day-allday">
          {allDay.map((t) => (
            <span className="day-allday-pill" key={t.id}>
              {CATEGORY_ICON[t.category] ?? "•"} {t.title}
            </span>
          ))}
        </div>
      )}

      {timed.length === 0 && allDay.length === 0 ? (
        <p className="note" style={{ marginTop: 24 }}>
          Nothing scheduled with a time today. Enjoy the breathing room. 🌿
        </p>
      ) : (
        <div className="day-grid" style={{ height: gridHeight }}>
          {hours.map((h) => (
            <div
              className="day-hour"
              key={h}
              style={{ top: (h - DAY_START) * 60 * PX_PER_MIN }}
            >
              <span className="day-hour-label">
                {DateTime.fromObject({ hour: h }).toFormat("HH:mm")}
              </span>
              <span className="day-hour-line" />
            </div>
          ))}

          {nowTop !== null && (
            <div className="day-now" style={{ top: nowTop }} aria-label="now">
              <span className="day-now-dot" />
            </div>
          )}

          {timed.map(({ t, dt }) => {
            const top = ((dt.hour - DAY_START) * 60 + dt.minute) * PX_PER_MIN;
            const mins = t.estimate_minutes && t.estimate_minutes > 0 ? t.estimate_minutes : 30;
            const height = Math.max(34, mins * PX_PER_MIN);
            const past = dt < now;
            return (
              <div
                className={`day-event ${past ? "past" : ""}`}
                key={t.id}
                style={{ top, height }}
              >
                <span className="day-event-time">{dt.toFormat("HH:mm")}</span>
                <span className="day-event-title">
                  {CATEGORY_ICON[t.category] ?? "•"} {t.title}
                </span>
                {t.estimate_minutes ? (
                  <span className="day-event-est">~{t.estimate_minutes}m</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
