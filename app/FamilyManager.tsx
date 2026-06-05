"use client";

import { useState } from "react";
import type { Household, Member } from "@/lib/households";

export default function FamilyManager({
  household,
  members,
  meId,
}: {
  household: Household | null;
  members: Member[];
  meId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/family", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (r.ok) location.reload();
    else setMsg("Couldn't create your family.");
  }

  async function invite() {
    if (!email.includes("@")) {
      setMsg("Enter a valid email.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (r.ok) {
      setMsg(`Invite sent to ${email}.`);
      setEmail("");
    } else {
      setMsg(d.error || "Couldn't send the invite.");
    }
  }

  async function leave() {
    if (!confirm("Leave this family? Tasks you shared will become private again.")) {
      return;
    }
    setBusy(true);
    const r = await fetch("/api/family/leave", { method: "POST" });
    setBusy(false);
    if (r.ok) location.reload();
  }

  if (!household) {
    return (
      <div className="profile-form">
        <section className="profile-card">
          <h2 className="section">Start a family</h2>
          <p className="note">
            Create a shared space, then invite people by email. You can share
            tasks to the family and everyone gets the nudge.
          </p>
          <label className="field">
            <span>Family name</span>
            <input
              value={name}
              placeholder="e.g. The Pearces"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy} onClick={create}>
            Create family
          </button>
          {msg && <p className="note err">{msg}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="profile-form">
      <section className="profile-card">
        <h2 className="section">{household.name}</h2>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id}>
              <span className="member-name">
                {m.name || m.email}
                {m.id === meId ? " (you)" : ""}
              </span>
              <span className="chip">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="profile-card">
        <h2 className="section">Invite someone</h2>
        <label className="field">
          <span>Their email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy} onClick={invite}>
          Send invite
        </button>
        {msg && <p className="note">{msg}</p>}
      </section>

      <section className="profile-card">
        <button onClick={leave} disabled={busy}>
          Leave family
        </button>
      </section>
    </div>
  );
}
