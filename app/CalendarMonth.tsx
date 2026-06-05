"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import TaskCard, { type TaskView } from "./TaskCard";

export interface CalDay {
  key: string;
  day: number;
  out: boolean;
  today: boolean;
  tasks: TaskView[];
}

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

/** A task is a multi-day span when it has an end date on a different day. */
function isSpan(t: TaskView): boolean {
  return Boolean(
    t.end_at && t.due_at && t.end_at.slice(0, 10) !== t.due_at.slice(0, 10),
  );
}

interface Bar {
  task: TaskView;
  startCol: number; // 0..6 within the week
  endCol: number; // 0..6 within the week
  lane: number;
  roundedLeft: boolean; // span actually starts in this week
  roundedRight: boolean; // span actually ends in this week
}

/** Lay out the spans that overlap a week into stacked lanes of bar segments. */
function weekBars(week: CalDay[], spans: TaskView[]): { bars: Bar[]; lanes: number } {
  const weekStart = week[0].key;
  const weekEnd = week[6].key;
  const overlapping = spans
    .filter((t) => {
      const s = t.due_at!.slice(0, 10);
      const e = t.end_at!.slice(0, 10);
      return s <= weekEnd && e >= weekStart;
    })
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));

  const laneEndCol: number[] = [];
  const bars: Bar[] = [];
  for (const t of overlapping) {
    const s = t.due_at!.slice(0, 10);
    const e = t.end_at!.slice(0, 10);
    const startCol = s < weekStart ? 0 : week.findIndex((d) => d.key === s);
    const endCol = e > weekEnd ? 6 : week.findIndex((d) => d.key === e);
    let lane = laneEndCol.findIndex((end) => end < startCol);
    if (lane === -1) {
      lane = laneEndCol.length;
      laneEndCol.push(endCol);
    } else {
      laneEndCol[lane] = endCol;
    }
    bars.push({
      task: t,
      startCol,
      endCol,
      lane,
      roundedLeft: s >= weekStart,
      roundedRight: e <= weekEnd,
    });
  }
  return { bars, lanes: laneEndCol.length };
}

export default function CalendarMonth({
  days,
  lifeAreas,
  categories,
  initialSelected,
}: {
  days: CalDay[];
  lifeAreas: string[];
  categories: string[];
  initialSelected: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(initialSelected);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "reminder");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedDay = days.find((d) => d.key === selected) ?? null;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Unique multi-day spans across the grid, drawn as continuous bars.
  const spanMap = new Map<string, TaskView>();
  for (const d of days) for (const t of d.tasks) if (isSpan(t)) spanMap.set(t.id, t);
  const spans = [...spanMap.values()];
  const weeks: CalDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  async function addNudge() {
    if (!selected || title.trim() === "") return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        due_at: time ? `${selected}T${time}:00` : selected,
        due_type: time ? "datetime" : "date",
      }),
    });
    setTitle("");
    setTime("");
    setSaving(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="cal-dow-row">
        {dow.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const { bars, lanes } = weekBars(week, spans);
        return (
          <div
            key={wi}
            className="cal-week"
            style={{ "--lanes": lanes } as React.CSSProperties}
          >
            <div className="cal-week-cells">
              {week.map((d) => {
                const singles = d.tasks.filter((t) => !isSpan(t));
                return (
                  <button
                    key={d.key}
                    className={`cal-cell ${d.out ? "out" : ""} ${
                      d.today ? "today" : ""
                    } ${d.key === selected ? "selected" : ""}`}
                    onClick={() => setSelected(d.key)}
                  >
                    <span className="cal-date">{d.day}</span>
                    {singles.slice(0, 2).map((t) => (
                      <span key={t.id} className="cal-pill" title={t.title}>
                        {ICON[t.category] ?? "•"} {t.title}
                      </span>
                    ))}
                    {singles.length > 2 && (
                      <span className="cal-more">+{singles.length - 2} more</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="cal-week-bars" aria-hidden="true">
              {bars.map((b) => (
                <span
                  key={b.task.id}
                  className={`cal-bar ${b.roundedLeft ? "is-start" : ""} ${
                    b.roundedRight ? "is-end" : ""
                  }`}
                  title={b.task.title}
                  style={{
                    left: `calc(${b.startCol} / 7 * 100%)`,
                    width: `calc(${b.endCol - b.startCol + 1} / 7 * 100%)`,
                    top: `${b.lane * 19}px`,
                  }}
                >
                  {b.roundedLeft ? `${ICON[b.task.category] ?? ""} ${b.task.title}` : "…"}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {selectedDay && (
        <div className="day-panel">
          <h2 className="section">
            {DateTime.fromISO(selectedDay.key).toFormat("cccc d LLLL")}
          </h2>

          {selectedDay.tasks.length === 0 ? (
            <div className="empty">Nothing scheduled.</div>
          ) : (
            selectedDay.tasks.map((t) => (
              <TaskCard key={t.id} task={t} lifeAreas={lifeAreas} />
            ))
          )}

          <div className="edit-form day-add">
            <div className="filter-label">Add a nudge to this day</div>
            <label className="field">
              <span>What</span>
              <input
                value={title}
                placeholder="e.g. Dentist appointment"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Type</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Time (optional)</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            </div>
            <button
              className="primary"
              onClick={addNudge}
              disabled={saving || title.trim() === ""}
            >
              {saving ? "Adding…" : "Add nudge"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
