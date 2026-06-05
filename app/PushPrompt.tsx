"use client";

import { useEffect, useState } from "react";
import { enableBrowserPush } from "./pushClient";

/**
 * One-time, in-context prompt to enable reminders. Shows only when push is
 * configured server-side, the browser supports it, permission hasn't been
 * decided yet, and the user hasn't dismissed it.
 */
export default function PushPrompt({ available }: { available: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("nudge_push_dismissed") === "1") return;
    setShow(true);
  }, [available]);

  if (!show) return null;

  async function enable() {
    setBusy(true);
    setMsg(null);
    const r = await enableBrowserPush();
    setBusy(false);
    if (r.ok) {
      setMsg("Reminders are on — we’ll nudge you. 🎉");
      setTimeout(() => setShow(false), 1800);
    } else if (r.reason === "denied") {
      setMsg("No worries — you can turn these on later in Settings.");
      setTimeout(() => setShow(false), 2600);
    } else {
      setMsg("Couldn’t enable notifications on this device.");
    }
  }

  function dismiss() {
    try {
      localStorage.setItem("nudge_push_dismissed", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="push-prompt">
      <div className="push-prompt-text">
        <strong>Turn on reminders</strong>
        <span>Let nudge notify you before things slip.</span>
      </div>
      <div className="push-prompt-actions">
        <button className="primary" onClick={enable} disabled={busy}>
          {busy ? "…" : "Enable"}
        </button>
        <button onClick={dismiss} disabled={busy}>
          Not now
        </button>
      </div>
      {msg && <p className="note push-prompt-msg">{msg}</p>}
    </div>
  );
}
