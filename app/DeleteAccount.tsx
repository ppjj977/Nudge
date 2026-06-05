"use client";

import { useState } from "react";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/account/delete", { method: "POST" });
    if (r.ok) {
      location.href = "/login";
    } else {
      setBusy(false);
      setError("Couldn't delete your account. Please try again.");
    }
  }

  return (
    <div className="profile-form" style={{ marginTop: 16 }}>
      <section className="profile-card danger-card">
        <h2 className="section">Delete account</h2>
        <p className="note">
          Permanently deletes your account and all your data — tasks, captures,
          reminders and family membership. This can&apos;t be undone.
        </p>
        {!open ? (
          <button className="danger-btn" onClick={() => setOpen(true)}>
            Delete my account
          </button>
        ) : (
          <>
            <label className="field">
              <span>Type DELETE to confirm</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>
            <div className="auth-actions">
              <button
                className="danger-btn"
                disabled={busy || confirm.trim().toUpperCase() !== "DELETE"}
                onClick={remove}
              >
                {busy ? "Deleting…" : "Permanently delete"}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </>
        )}
        {error && <p className="note err">{error}</p>}
      </section>
    </div>
  );
}
