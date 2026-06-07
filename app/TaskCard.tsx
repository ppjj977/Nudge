"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import type { Member } from "@/lib/households";

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface TaskView {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  due_at: string | null;
  due_type: string;
  end_at: string | null;
  amount: number | null;
  currency: string | null;
  location: string | null;
  life_area: string | null;
  checklist: ChecklistItem[] | null;
  status: string;
  confidence: number;
  source_excerpt: string | null;
  snoozed_until: string | null;
  household_id: string | null;
  assignee_id: string | null;
  recurrence: { freq: string; interval: number } | null;
  estimate_minutes: number | null;
  leave_minutes: number | null;
}

const CATEGORY_ICON: Record<string, string> = {
  pay: "💷",
  book: "📅",
  attend: "📍",
  prepare: "🎒",
  send: "✉️",
  renew: "🔁",
  trip: "🧳",
  celebrate: "🎂",
  reminder: "⏰",
  fyi: "📄",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function dueLabel(t: TaskView): string | null {
  if (!t.due_at || t.due_type === "none") return null;
  const start = new Date(t.due_at);
  if (Number.isNaN(start.getTime())) return t.due_at;
  const startStr = t.due_type === "datetime" ? fmtDateTime(start) : fmtDate(start);

  // Multi-day span: show "start – end" when the end is a different day.
  if (t.end_at && t.end_at.slice(0, 10) !== t.due_at.slice(0, 10)) {
    const end = new Date(t.end_at);
    if (!Number.isNaN(end.getTime())) return `${startStr} – ${fmtDate(end)}`;
  }
  return startStr;
}

function amountLabel(t: TaskView): string | null {
  if (t.amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: t.currency || "GBP",
    }).format(t.amount);
  } catch {
    return `${t.currency || ""} ${t.amount}`.trim();
  }
}

type Mode = "active" | "review" | "done";

export default function TaskCard({
  task,
  review = false,
  done = false,
  lifeAreas = [],
  inHousehold = false,
  readOnly = false,
  ownerName = null,
  members = [],
  assignable = false,
  onActioned,
}: {
  task: TaskView;
  review?: boolean;
  done?: boolean;
  lifeAreas?: string[];
  /** User is in a family, so show the share toggle. */
  inHousehold?: boolean;
  /** Family view of someone else's task: show it, but no actions. */
  readOnly?: boolean;
  /** Owner's name, shown as a chip in the family view. */
  ownerName?: string | null;
  /** Household members, to populate the assignee picker. */
  members?: Member[];
  /** Show the "assigned to" picker (family view of a shared task). */
  assignable?: boolean;
  /** Called after a terminal action (done/dismiss/confirm/edit) — lets a
   *  caller drop this card from a local snapshot list (e.g. capture verify). */
  onActioned?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const mode: Mode = done ? "done" : review ? "review" : "active";

  async function call(url: string, method: string, body?: object, terminal = false) {
    await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    // Terminal actions remove the task from the active view; let a snapshot
    // caller drop it too (otherwise it lingers in the capture-verify list).
    if (terminal) onActioned?.();
    startTransition(() => router.refresh());
  }

  const complete = () =>
    call(
      `/api/tasks/${task.id}`,
      "PATCH",
      { status: task.category === "pay" ? "paid" : "done" },
      true,
    );
  const dismiss = () => call(`/api/tasks/${task.id}`, "DELETE", undefined, true);
  const confirm = () => call(`/api/tasks/${task.id}/confirm`, "POST", undefined, true);
  const toggleShare = () =>
    call(`/api/tasks/${task.id}/share`, "POST", { share: !task.household_id });
  const assign = (assignee_id: string) =>
    call(`/api/tasks/${task.id}`, "PATCH", { assignee_id: assignee_id || null });
  const assigneeName =
    task.assignee_id != null
      ? (members.find((m) => m.id === task.assignee_id)?.name ??
        members.find((m) => m.id === task.assignee_id)?.email ??
        null)
      : null;
  const undo = () => call(`/api/tasks/${task.id}`, "PATCH", { status: "active" });

  const breakdown = async () => {
    setBreaking(true);
    await fetch(`/api/tasks/${task.id}/breakdown`, { method: "POST" }).catch(() => {});
    setBreaking(false);
    startTransition(() => router.refresh());
  };

  const toggleItem = (index: number) => {
    if (!task.checklist) return;
    const next = task.checklist.map((it, i) =>
      i === index ? { ...it, done: !it.done } : it,
    );
    call(`/api/tasks/${task.id}`, "PATCH", { checklist: next });
  };

  if (editing) {
    return (
      <EditForm
        task={task}
        lifeAreas={lifeAreas}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onActioned?.();
          startTransition(() => router.refresh());
        }}
      />
    );
  }

  const meta = [dueLabel(task), amountLabel(task)].filter(Boolean).join(" · ");
  const mapsUrl = task.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`
    : null;

  const repeatLabel = task.recurrence
    ? task.recurrence.interval > 1
      ? `Every ${task.recurrence.interval} ${task.recurrence.freq.replace("ly", "")}s`
      : { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" }[
          task.recurrence.freq
        ] ?? "Repeats"
    : null;

  const isFyi = task.category === "fyi";
  const lowConfidence = task.confidence < 0.6;
  const snoozedUntil =
    task.snoozed_until && new Date(task.snoozed_until) > new Date()
      ? new Date(task.snoozed_until)
      : null;
  const snoozeLabel = snoozedUntil
    ? `Next nudge: ${snoozedUntil.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : undefined;

  return (
    <div className={`task ${isFyi ? "fyi" : ""} ${done ? "is-done" : ""}`}>
      <div className="body">
        <div>
          <span className="task-emoji" aria-hidden="true">
            {CATEGORY_ICON[task.category] ?? "•"}
          </span>
          <span className="title">{task.title}</span>
        </div>
        <div className="chips">
          <span className="chip cat">{task.category}</span>
          {repeatLabel && <span className="chip">🔁 {repeatLabel}</span>}
          {task.life_area && <span className="chip">{task.life_area}</span>}
          {ownerName && <span className="chip owner">{ownerName}</span>}
          {!ownerName && task.household_id && (
            <span className="chip owner">shared</span>
          )}
          {assigneeName && <span className="chip assignee">for {assigneeName}</span>}
          {lowConfidence && (
            <span className="chip low-conf">
              ~{Math.round(task.confidence * 100)}% sure
            </span>
          )}
        </div>
        {task.detail && <div className="meta">{task.detail}</div>}
        {meta && <div className="meta">{meta}</div>}
        {task.location && (
          <div className="meta">
            📍{" "}
            <a className="map-link" href={mapsUrl!} target="_blank" rel="noreferrer">
              {task.location}
            </a>
          </div>
        )}
        {task.estimate_minutes ? (
          <div className="meta">⏱️ ~{task.estimate_minutes} min</div>
        ) : null}
        {task.checklist && task.checklist.length > 0 && (
          <ul className="checklist">
            {task.checklist.map((item, i) => (
              <li key={i} className={item.done ? "checked" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={pending || mode !== "active"}
                    onChange={() => toggleItem(i)}
                  />
                  <span>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {task.source_excerpt && (
          <div className="excerpt">“{task.source_excerpt}”</div>
        )}
      </div>

      {assignable && members.length > 0 && (
        <div className="assign-row">
          <span>Assigned to</span>
          <select
            value={task.assignee_id ?? ""}
            onChange={(e) => assign(e.target.value)}
            disabled={pending}
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {!readOnly && (
        <div className="actions">
          {mode === "done" ? (
            <>
              <button className="primary" onClick={undo} disabled={pending}>
                Undo
              </button>
              <button onClick={dismiss} disabled={pending}>
                Delete
              </button>
            </>
          ) : (
            <>
              {mode === "review" && (
                <button className="primary" onClick={confirm} disabled={pending}>
                  Confirm
                </button>
              )}
              {mode === "active" && !isFyi && (
                <button onClick={complete} disabled={pending}>
                  {task.category === "pay" ? "Paid" : "Done"}
                </button>
              )}
              {mode === "active" && (
                <button
                  className={snoozedUntil ? "snoozed" : ""}
                  title={snoozeLabel}
                  onClick={() => setSnoozing((s) => !s)}
                  disabled={pending}
                >
                  {snoozedUntil ? "💤 Snoozed" : "Snooze"}
                </button>
              )}
              {mode === "active" && !isFyi && (
                <button onClick={breakdown} disabled={pending || breaking}>
                  {breaking ? "Thinking…" : "✨ Break it down"}
                </button>
              )}
              {mode === "active" && inHousehold && (
                <button
                  className={task.household_id ? "snoozed" : ""}
                  onClick={toggleShare}
                  disabled={pending}
                >
                  {task.household_id ? "✓ Shared" : "Share with family"}
                </button>
              )}
              <button onClick={() => setEditing(true)} disabled={pending}>
                Edit
              </button>
              <button onClick={dismiss} disabled={pending}>
                Dismiss
              </button>
            </>
          )}
        </div>
      )}

      {snoozing && (
        <SnoozePicker
          disabled={pending}
          onCancel={() => setSnoozing(false)}
          onPick={(date, time) => {
            setSnoozing(false);
            call(`/api/tasks/${task.id}/snooze`, "POST", { date, time });
          }}
        />
      )}
    </div>
  );
}

/* ---- snooze: pick when to be nudged next ---- */

function SnoozePicker({
  onPick,
  onCancel,
  disabled,
}: {
  onPick: (date: string, time: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("09:00");

  return (
    <div className="snooze-picker">
      <span className="snooze-lead">Nudge me again on…</span>
      <div className="snooze-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <button
          className="primary"
          disabled={disabled || !date}
          onClick={() => onPick(date, time)}
        >
          Nudge me
        </button>
        <button onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---- inline edit form ---- */

function EditForm({
  task,
  lifeAreas,
  onCancel,
  onSaved,
}: {
  task: TaskView;
  lifeAreas: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const initialDate =
    task.due_at && task.due_type !== "none" ? task.due_at.slice(0, 10) : "";
  const initialTime =
    task.due_type === "datetime" && task.due_at
      ? task.due_at.slice(11, 16)
      : "";
  const initialEnd = task.end_at ? task.end_at.slice(0, 10) : "";

  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [endDate, setEndDate] = useState(initialEnd);
  const [repeat, setRepeat] = useState(task.recurrence?.freq ?? "none");
  const [amount, setAmount] = useState(task.amount?.toString() ?? "");
  const [location, setLocation] = useState(task.location ?? "");
  const [leaveMin, setLeaveMin] = useState(task.leave_minutes?.toString() ?? "");
  const [category, setCategory] = useState<string>(task.category);
  const [lifeArea, setLifeArea] = useState(task.life_area ?? "");
  const [items, setItems] = useState<ChecklistItem[]>(
    task.checklist ? task.checklist.map((c) => ({ ...c })) : [],
  );
  const [saving, setSaving] = useState(false);

  // Keep the task's current area selectable even if it's no longer in the list.
  const areaOptions =
    task.life_area && !lifeAreas.includes(task.life_area)
      ? [task.life_area, ...lifeAreas]
      : lifeAreas;

  const setItemText = (i: number, text: string) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, text } : it)));
  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, j) => j !== i));
  const addItem = () =>
    setItems((prev) => [...prev, { text: "", done: false }]);

  async function save() {
    setSaving(true);
    const patch: Record<string, unknown> = {
      title: title.trim(),
      detail: detail.trim() || null,
      location: location.trim() || null,
      life_area: lifeArea || null,
    };
    // Leave-by lead time only applies to a timed task with a place.
    const lm = leaveMin.trim() === "" ? null : Math.max(0, Math.round(Number(leaveMin)));
    patch.leave_minutes = location.trim() && time && lm && lm > 0 ? lm : null;
    const cleanedItems = items
      .map((it) => ({ text: it.text.trim(), done: it.done }))
      .filter((it) => it.text.length > 0);
    patch.checklist = cleanedItems.length > 0 ? cleanedItems : null;
    patch.category = category;
    if (category === "pay") {
      patch.amount = amount.trim() === "" ? null : Number(amount);
      patch.currency = task.currency || "GBP";
    } else {
      patch.amount = null;
      patch.currency = null;
    }
    if (!date) {
      patch.due_type = "none";
      patch.due_at = null;
    } else if (!time) {
      patch.due_type = "date";
      patch.due_at = date;
    } else {
      patch.due_type = "datetime";
      patch.due_at = `${date}T${time}:00`;
    }
    // Multi-day span: keep end only when it's on/after the start.
    patch.end_at = date && endDate && endDate >= date ? endDate : null;
    // Recurrence needs a date to anchor to; clear it otherwise.
    patch.recurrence =
      date && repeat !== "none" ? { freq: repeat, interval: 1 } : null;
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="task editing">
      <div className="body edit-form">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Detail</span>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Due date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Time (optional)</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!date}
            />
          </label>
          <label className="field">
            <span>End date (optional)</span>
            <input
              type="date"
              value={endDate}
              min={date || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!date}
            />
          </label>
          <label className="field">
            <span>Repeat</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={!date}
            >
              <option value="none">Doesn&apos;t repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
        </div>
        {category === "pay" && (
          <label className="field">
            <span>Amount ({task.currency || "GBP"})</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        {(category === "attend" || category === "book") && (
          <div className="field-row">
            <label className="field">
              <span>Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="field">
              <span>Leave-by (mins before)</span>
              <input
                type="number"
                min="0"
                step="5"
                placeholder="e.g. 20"
                value={leaveMin}
                onChange={(e) => setLeaveMin(e.target.value)}
                disabled={!time || !location.trim()}
              />
            </label>
          </div>
        )}
        <label className="field">
          <span>Life area</span>
          <select
            value={lifeArea}
            onChange={(e) => setLifeArea(e.target.value)}
          >
            <option value="">— none —</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Checklist</span>
          {items.map((it, i) => (
            <div key={i} className="rule-row">
              <input
                value={it.text}
                placeholder="e.g. Bring PE kit"
                onChange={(e) => setItemText(i, e.target.value)}
              />
              <button className="link" type="button" onClick={() => removeItem(i)}>
                remove
              </button>
            </div>
          ))}
          <button className="link" type="button" onClick={addItem}>
            + add item
          </button>
        </div>
        <div className="capture-row">
          <button className="primary" onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
