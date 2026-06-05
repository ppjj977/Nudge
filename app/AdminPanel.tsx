"use client";

import { useState } from "react";

interface Code {
  code: string;
  duration_days: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
}

export default function AdminPanel({ codes }: { codes: Code[] }) {
  // create code
  const [code, setCode] = useState("");
  const [days, setDays] = useState("");
  const [max, setMax] = useState("");
  const [note, setNote] = useState("");
  // grant pro
  const [email, setEmail] = useState("");
  const [grantDays, setGrantDays] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createCode() {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        durationDays: days ? Number(days) : null,
        maxRedemptions: max ? Number(max) : null,
        note: note || null,
      }),
    });
    setBusy(false);
    if (r.ok) {
      setMsg(`Code ${code.toUpperCase()} created.`);
      setTimeout(() => location.reload(), 800);
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Couldn’t create that code.");
    }
  }

  async function grant() {
    if (!email.includes("@")) {
      setMsg("Enter a valid email.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, durationDays: grantDays ? Number(grantDays) : null }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Pro granted to ${email}.` : d.error || "Couldn’t grant Pro.");
    if (r.ok) setEmail("");
  }

  return (
    <>
      <section className="panel">
        <h2 className="section">Grant Pro to someone</h2>
        <div className="field-row">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Days (blank = forever)</span>
            <input type="number" value={grantDays} onChange={(e) => setGrantDays(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={busy} onClick={grant}>
          Grant Pro
        </button>
      </section>

      <section className="panel">
        <h2 className="section">Create a promo code</h2>
        <div className="field-row">
          <label className="field">
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            <span>Days (blank = forever)</span>
            <input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label className="field">
            <span>Max uses (blank = ∞)</span>
            <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="primary" disabled={busy || !code.trim()} onClick={createCode}>
          Create code
        </button>
        {msg && <p className="note">{msg}</p>}

        {codes.length > 0 && (
          <ul className="code-list">
            {codes.map((c) => (
              <li key={c.code}>
                <b>{c.code}</b>
                <span>
                  {c.duration_days ? `${c.duration_days}d` : "forever"} ·{" "}
                  {c.redeemed_count}
                  {c.max_redemptions != null ? `/${c.max_redemptions}` : ""} used
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
