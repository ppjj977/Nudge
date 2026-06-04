"use client";

import { useTransition } from "react";
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

/** A single task row with category-aware actions (SPEC §10 PATCH/confirm/delete). */
export default function TaskCard({
  task,
  review = false,
}: {
  task: TaskView;
  review?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  // Toggle one checklist item. Progress-only: the task stays active until the
  // user presses Done, even when every item is ticked.
  const toggleItem = (index: number) => {
    if (!task.checklist) return;
    const next = task.checklist.map((it, i) =>
      i === index ? { ...it, done: !it.done } : it,
    );
    call(`/api/tasks/${task.id}`, "PATCH", { checklist: next });
  };

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
    <div className={`task ${isFyi ? "fyi" : ""}`}>
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
                    disabled={pending || review}
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
      {!isFyi && (
        <div className="actions">
          {review && (
            <button className="primary" onClick={confirm} disabled={pending}>
              Confirm
            </button>
          )}
          {!review && (
            <button onClick={complete} disabled={pending}>
              {task.category === "pay" ? "Paid" : "Done"}
            </button>
          )}
          <button onClick={dismiss} disabled={pending}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
