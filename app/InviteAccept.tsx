"use client";

import { useState } from "react";

export default function InviteAccept({
  token,
  householdName,
  loggedIn,
  invitedEmail,
}: {
  token: string;
  householdName: string | null;
  loggedIn: boolean;
  invitedEmail: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!householdName) {
    return <p className="note err">This invite is invalid or has expired.</p>;
  }

  async function accept() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/family/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (r.ok) location.href = "/family";
    else setMsg(d.error || "Couldn't accept the invite.");
  }

  const next = encodeURIComponent(`/family/join?token=${token}`);

  return (
    <div className="auth">
      <p className="note">
        You&apos;ve been invited to join <strong>{householdName}</strong>.
      </p>
      {loggedIn ? (
        <button className="primary auth-submit" disabled={busy} onClick={accept}>
          Accept invite
        </button>
      ) : (
        <>
          <a className="btn-primary-lg" href={`/signup?next=${next}`}>
            Create account &amp; join
          </a>
          <p className="auth-foot">
            Already have an account? <a href={`/login?next=${next}`}>Sign in</a>
          </p>
          {invitedEmail && (
            <p className="note">Tip: use {invitedEmail} so it matches your invite.</p>
          )}
        </>
      )}
      {msg && <p className="note err">{msg}</p>}
    </div>
  );
}
