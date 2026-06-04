"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  amount: number | null;
  currency: string | null;
  location: string | null;
  life_area: string | null;
  checklist: ChecklistItem[] | null;
  status: string;
  confidence: number;
  source_excerpt: string | null;
}

const CATEGORY_ICON: Record<string, string> = {
  pay: "💷",
  book: "📅",
  attend: "📍",
  prepare: "🎒",
  send: "✉️",
  renew: "🔁",
  reminder: "⏰",
  fyi: "📄",
};

function dueLabel(t: TaskView): string | null {
  if (!t.due_at || t.due_type === "none") return null;
  const d = new Date(t.due_at);
  if (Number.isNaN(d.getTime())) return t.due_at;
  return t.due_type === "datetime"
    ? d.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
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
}: {
  task: TaskView;
  review?: boolean;
  done?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const mode: Mode = done ? "done" : review ? "review" : "active";

  async function call(url: string, method: string, body?: object) {
    await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    startTransition(() => router.refresh());
  }

  const complete = () =>
    call(`/api/tasks/${task.id}`, "PATCH", {
      status: task.category === "pay" ? "paid" : "done",
    });
  const dismiss = () => call(`/api/tasks/${task.id}`, "DELETE");
  const confirm = () => call(`/api/tasks/${task.id}/confirm`, "POST");
  const undo = () => call(`/api/tasks/${task.id}`, "PATCH", { status: "active" });

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
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          startTransition(() => router.refresh());
        }}
      />
    );
  }

  const meta = [
    dueLabel(task),
    amountLabel(task),
    task.location,
    review ? `${Math.round(task.confidence * 100)}% sure` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const isFyi = task.category === "fyi";

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
          {task.life_area && <span className="chip">{task.life_area}</span>}
        </div>
        {task.detail && <div className="meta">{task.detail}</div>}
        {meta && <div className="meta">{meta}</div>}
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
            <button onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </button>
            <button onClick={dismiss} disabled={pending}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- inline edit form ---- */

function EditForm({
  task,
  onCancel,
  onSaved,
}: {
  task: TaskView;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const initialDate =
    task.due_at && task.due_type !== "none" ? task.due_at.slice(0, 10) : "";
  const initialTime =
    task.due_type === "datetime" && task.due_at
      ? task.due_at.slice(11, 16)
      : "";

  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [amount, setAmount] = useState(task.amount?.toString() ?? "");
  const [location, setLocation] = useState(task.location ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const patch: Record<string, unknown> = {
      title: title.trim(),
      detail: detail.trim() || null,
      location: location.trim() || null,
    };
    if (task.category === "pay") {
      patch.amount = amount.trim() === "" ? null : Number(amount);
      patch.currency = task.currency || "GBP";
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
        </div>
        {task.category === "pay" && (
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
        {(task.category === "attend" || task.category === "book") && (
          <label className="field">
            <span>Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
        )}
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
