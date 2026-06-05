"use client";

import { useState } from "react";

const COHORT = 10;

export default function RegisterInterest({ source }: { source?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    position: number;
    freeForLife: boolean;
    already: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!email.includes("@")) {
      setErr("Enter a valid email so we can let you know.");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, note, source: source ?? null }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setDone({ position: d.position, freeForLife: d.freeForLife, already: d.already });
    } else {
      setErr(d.error || "Something went wrong — try again in a moment.");
    }
  }

  if (done) {
    return (
      <div className="auth interest-done">
        <div className="interest-tick">✓</div>
        <h2>{done.already ? "You’re already on the list" : "You’re on the list!"}</h2>
        <p className="note">
          You’re <b>#{done.position}</b> in the queue.
        </p>
        {done.freeForLife ? (
          <p className="interest-prize">
            🎉 You made the first {COHORT} — that means <b>Nudge Pro free for life</b> when
            we launch. We’ll email your invite to <b>{email}</b>.
          </p>
        ) : (
          <p className="note">
            We’ll email <b>{email}</b> the moment Nudge opens up. Early sign-ups get the
            best launch perks.
          </p>
        )}
        <p className="note">
          Want to bump up the queue? Share Nudge with a friend who drowns in life-admin.
        </p>
      </div>
    );
  }

  return (
    <div className="auth">
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="field">
        <span>What would you use Nudge for? (optional)</span>
        <input
          type="text"
          value={note}
          placeholder="School admin, bills, appointments…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button className="primary auth-submit" onClick={submit} disabled={busy}>
        {busy ? "Adding you…" : "Register my interest"}
      </button>
      {err && <p className="note auth-msg">{err}</p>}
      <p className="note">
        No spam — just one email when Nudge opens up. Unsubscribe any time.
      </p>
    </div>
  );
}
