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
  // demo / Play-review account
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPass, setDemoPass] = useState("");
  const [demoResult, setDemoResult] = useState<{ email: string; password: string } | null>(null);

  async function makeDemo() {
    setBusy(true);
    setDemoResult(null);
    setMsg(null);
    const r = await fetch("/api/admin/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: demoEmail || undefined, password: demoPass || undefined }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setDemoResult({ email: d.email, password: d.password });
    } else {
      setMsg(d.error || "Couldn’t create the demo account.");
    }
  }

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
        <h2 className="section">Play-review demo account</h2>
        <p className="note">
          Creates (or refreshes) a login for Google Play reviewers — comped to Pro
          with sample tasks. Leave blank for the defaults. Paste the result into
          Play Console → App access.
        </p>
        <div className="field-row">
          <label className="field">
            <span>Email (blank = reviewer@nudgelive.co.uk)</span>
            <input type="email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password (blank = a default)</span>
            <input value={demoPass} onChange={(e) => setDemoPass(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={busy} onClick={makeDemo}>
          Create / refresh demo account
        </button>
        {demoResult && (
          <div className="note" style={{ marginTop: 10 }}>
            ✓ Ready. Give Play these credentials:
            <br />
            <b>Email:</b> {demoResult.email}
            <br />
            <b>Password:</b> {demoResult.password}
          </div>
        )}
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
