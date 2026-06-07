"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface WatchItem {
  id: string;
  url: string;
  condition: string;
  label: string | null;
  status: string;
  last_checked: string | null;
  last_note: string | null;
}

export default function WatchManager({
  initial,
  pro,
}: {
  initial: WatchItem[];
  pro: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [condition, setCondition] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!url.trim() || !condition.trim()) {
      setMsg("Add a web address and what to watch for.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, condition, label: label || null }),
    });
    setBusy(false);
    if (r.ok) {
      setLabel("");
      setUrl("");
      setCondition("");
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Couldn’t add that watch.");
    }
  }

  async function remove(id: string) {
    await fetch(`/api/watch?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <section className="panel">
        <h2 className="section">New watch</h2>
        <label className="field">
          <span>Name (optional)</span>
          <input value={label} placeholder="PS5 restock" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="field">
          <span>Web page to watch</span>
          <input
            value={url}
            placeholder="https://shop.example.com/product"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Tell me when…</span>
          <input
            value={condition}
            placeholder="it's back in stock / price drops below £80"
            onChange={(e) => setCondition(e.target.value)}
          />
        </label>
        <button className="primary" onClick={add} disabled={busy}>
          {busy ? "Adding…" : "Watch this"}
        </button>
        {msg && <p className="note">{msg}</p>}
        {!pro && (
          <p className="note">
            Free plan watches up to 2 pages. <a href="/upgrade">Nudge Pro</a> watches more.
          </p>
        )}
      </section>

      <section className="panel">
        <h2 className="section">Your watches</h2>
        {initial.length === 0 ? (
          <p className="note">Nothing yet — add your first watch above.</p>
        ) : (
          <ul className="watch-list">
            {initial.map((w) => (
              <li key={w.id} className={`watch-item ${w.status === "met" ? "met" : ""}`}>
                <div className="watch-main">
                  <b>{w.label || w.condition}</b>
                  <a className="watch-url" href={w.url} target="_blank" rel="noreferrer">
                    {prettyHost(w.url)}
                  </a>
                  <span className="watch-cond">Tell me when: {w.condition}</span>
                  <span className="watch-meta">
                    {w.status === "met"
                      ? `✅ Met${w.last_note ? ` — ${w.last_note}` : ""}`
                      : w.last_checked
                        ? `Last checked ${timeAgo(w.last_checked)}${w.last_note ? ` · ${w.last_note}` : ""}`
                        : "Not checked yet"}
                  </span>
                </div>
                <button className="link" onClick={() => remove(w.id)}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function prettyHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
