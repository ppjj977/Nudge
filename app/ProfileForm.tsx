"use client";

import { useState } from "react";

export default function ProfileForm({
  initialName,
  initialEmail,
  hasPassword,
}: {
  initialName: string;
  initialEmail: string;
  hasPassword: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function patch(body: object, success: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: success } : { ok: false, text: d.error || "Failed" });
    return r.ok;
  }

  return (
    <div className="profile-form">
      <section className="profile-card">
        <h2 className="section">Your details</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={() => patch({ name, email }, "Saved.")}
        >
          Save details
        </button>
      </section>

      <section className="profile-card">
        <h2 className="section">{hasPassword ? "Change password" : "Set a password"}</h2>
        {hasPassword && (
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
        )}
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={busy || newPassword.length === 0}
          onClick={async () => {
            const ok = await patch(
              { currentPassword, newPassword },
              "Password updated.",
            );
            if (ok) {
              setCurrentPassword("");
              setNewPassword("");
            }
          }}
        >
          {hasPassword ? "Update password" : "Set password"}
        </button>
      </section>

      {msg && <p className={`note ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
    </div>
  );
}
