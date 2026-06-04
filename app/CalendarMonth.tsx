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
  reminder: "⏰",
  fyi: "📄",
};

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
      <div className="cal-grid">
        {dow.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {days.map((d) => (
          <button
            key={d.key}
            className={`cal-cell ${d.out ? "out" : ""} ${d.today ? "today" : ""} ${
              d.key === selected ? "selected" : ""
            }`}
            onClick={() => setSelected(d.key)}
          >
            <span className="cal-date">{d.day}</span>
            {d.tasks.slice(0, 2).map((t) => (
              <span key={t.id} className="cal-pill" title={t.title}>
                {ICON[t.category] ?? "•"} {t.title}
              </span>
            ))}
            {d.tasks.length > 2 && (
              <span className="cal-more">+{d.tasks.length - 2} more</span>
            )}
          </button>
        ))}
      </div>

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
