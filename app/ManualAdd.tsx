"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CATEGORIES } from "@/lib/categories";

/** Manual task entry — the fallback to capture (SPEC §1). Collapsed by default. */
export default function ManualAdd() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(ACTION_CATEGORIES[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (title.trim() === "") return;
    setSaving(true);
    const body: Record<string, unknown> = { title, category };
    if (date) {
      body.due_at = time ? `${date}T${time}:00` : date;
      body.due_type = time ? "datetime" : "date";
      if (endDate && endDate >= date) body.end_at = endDate;
    }
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setTitle("");
    setDate("");
    setTime("");
    setEndDate("");
    setSaving(false);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <button className="add-toggle" onClick={() => setOpen(true)}>
        + Add a task manually
      </button>
    );
  }

  return (
    <div className="edit-form manual-add">
      <label className="field">
        <span>What needs doing?</span>
        <input
          autoFocus
          value={title}
          placeholder="e.g. Call the plumber"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {ACTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Due date (optional)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!date}
          />
        </label>
        <label className="field">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            min={date || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={!date}
          />
        </label>
      </div>
      <div className="capture-row">
        <button className="primary" onClick={add} disabled={saving || !title.trim()}>
          {saving ? "Adding…" : "Add task"}
        </button>
        <button onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
