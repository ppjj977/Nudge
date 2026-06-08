"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  source: string;
  status: string;
  subject: string | null;
  snippet: string;
  label: string; // "📨 from email · 2h ago"
}

/** "Came in, no task" captures — rescue into a task, or dismiss as "no action needed". */
export default function RecentCaptures({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [made, setMade] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function makeTask(it: Item) {
    const title = (it.subject || it.snippet || "Follow up").slice(0, 120);
    setBusy(it.id);
    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setBusy(null);
    if (r.ok) {
      setMade((prev) => new Set(prev).add(it.id));
      router.refresh();
    }
  }

  function dismiss(it: Item) {
    setDismissed((prev) => new Set(prev).add(it.id));
    fetch(`/api/captures?id=${encodeURIComponent(it.id)}`, { method: "DELETE" }).catch(
      () => {},
    );
  }

  const visible = items.filter((it) => !dismissed.has(it.id));
  if (visible.length === 0) return null;

  return (
    <section className="panel empty-captures">
      <h2 className="section">Came in — but no reminder made</h2>
      <p className="note">
        Nudge couldn’t spot a task in these. Make a task yourself, or dismiss if
        nothing was needed.
      </p>
      <ul className="ec-list">
        {visible.map((it) => (
          <li key={it.id} className="ec-item">
            <div className="ec-main">
              <span className="ec-label">{it.label}</span>
              <span className="ec-text">
                {it.subject ? <b>{it.subject}</b> : null}
                {it.subject && it.snippet ? " — " : ""}
                {it.snippet}
                {it.status === "failed" ? " (couldn’t read it)" : ""}
              </span>
            </div>
            <div className="ec-actions">
              {made.has(it.id) ? (
                <button
                  className="link ec-view"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  ✓ Added — view ↑
                </button>
              ) : (
                <>
                  <button onClick={() => makeTask(it)} disabled={busy === it.id}>
                    {busy === it.id ? "…" : "Make a task"}
                  </button>
                  <button className="link ec-dismiss" onClick={() => dismiss(it)}>
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
