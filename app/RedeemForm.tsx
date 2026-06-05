"use client";

import { useState } from "react";

const MESSAGES: Record<string, string> = {
  ok: "Code applied — you’re on Pro! 🎉",
  invalid: "That code isn’t valid.",
  exhausted: "That code has been fully used up.",
  expired: "That code has expired.",
  already: "You’ve already redeemed that code.",
};

export default function RedeemForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/plan/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = (await r.json().catch(() => ({}))) as { result?: string };
    setBusy(false);
    setMsg(MESSAGES[d.result ?? "invalid"] ?? "Couldn’t redeem that code.");
    if (d.result === "ok") {
      setCode("");
      setTimeout(() => location.reload(), 1200);
    }
  }

  return (
    <div>
      <label className="field">
        <span>Redeem a code</span>
        <input
          value={code}
          placeholder="e.g. FRIENDS2026"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </label>
      <button className="primary" disabled={busy || !code.trim()} onClick={redeem}>
        {busy ? "Checking…" : "Redeem"}
      </button>
      {msg && <p className="note">{msg}</p>}
    </div>
  );
}
