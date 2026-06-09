"use client";

import { DateTime } from "luxon";
import type { CalDay } from "./CalendarMonth";
import type { TaskView } from "./TaskCard";

const ICON: Record<string, string> = {
  pay: "💷",
  book: "📅",
  attend: "📍",
  prepare: "🎒",
  send: "✉️",
  renew: "🔁",
  trip: "🧳",
  reminder: "⏰",
  fyi: "📄",
};

/** Time label for a task: the clock time for datetime tasks, else nothing. */
function timeOf(t: TaskView): string {
  if (t.due_type === "datetime" && t.due_at) {
    const dt = DateTime.fromISO(t.due_at);
    if (dt.isValid) return dt.toFormat("HH:mm");
  }
  return "";
}

/**
 * Week view — seven tall day blocks (one per day) that list each task in full:
 * time, category, title and money, so you can see far more per day than the
 * month grid's two-pill preview. Tapping a task opens it on the timeline.
 */
export default function CalendarWeek({ days }: { days: CalDay[] }) {
  return (
    <div className="cal-weekview">
      {days.map((d) => {
        const date = DateTime.fromISO(d.key);
        return (
          <div key={d.key} className={`cal-dayblock ${d.today ? "today" : ""}`}>
            <div className="cal-dayblock-head">
              <span className="dow">{date.toFormat("ccc")}</span>
              <span className="dom">{date.toFormat("d LLL")}</span>
              {d.today && <span className="cal-today-chip">today</span>}
            </div>
            {d.tasks.length === 0 ? (
              <div className="cal-dayblock-empty">Nothing scheduled</div>
            ) : (
              <div className="cal-dayblock-tasks">
                {d.tasks.map((t) => (
                  <a key={t.id} className="cal-dayblock-task" href={`/?task=${t.id}`}>
                    <span className="t-time">{timeOf(t) || "•"}</span>
                    <span className="t-main">
                      <span className="t-title">
                        {ICON[t.category] ?? ""} {t.title}
                      </span>
                      <span className="t-meta">
                        <span className="chip cat">{t.category}</span>
                        {t.amount != null && (
                          <span className="t-amount">
                            {t.currency === "USD" ? "$" : t.currency === "EUR" ? "€" : "£"}
                            {t.amount}
                          </span>
                        )}
                        {t.location && <span className="t-where">{t.location}</span>}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
