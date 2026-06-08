"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (message.trim().length < 3) {
      setErr("Please add a little more detail.");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setMessage("");
    } else {
      const d = await r.json().catch(() => ({}));
      setErr(d.error || "Something went wrong — try again in a moment.");
    }
  }

  if (done) {
    return (
      <p className="note">
        Thanks — your feedback is on its way to us 💚 We read every message.
      </p>
    );
  }

  return (
    <div className="auth">
      <label className="field">
        <span>What’s working, what isn’t, or what you’d love to see?</span>
        <textarea
          rows={6}
          value={message}
          placeholder="Tell us anything — a bug, an idea, a frustration…"
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <button className="primary auth-submit" onClick={submit} disabled={busy}>
        {busy ? "Sending…" : "Send feedback"}
      </button>
      {err && <p className="note auth-msg">{err}</p>}
      <p className="note">We can’t always reply individually, but every note helps shape nudge.</p>
    </div>
  );
}
