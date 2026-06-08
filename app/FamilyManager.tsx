"use client";

import { useState } from "react";
import Link from "next/link";
import type { Household, Member } from "@/lib/households";

export default function FamilyManager({
  household,
  members,
  meId,
  isOwner = false,
  pro = false,
}: {
  household: Household | null;
  members: Member[];
  meId: string;
  isOwner?: boolean;
  pro?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    const d = (await r.json().catch(() => ({}))) as { error?: string; link?: string };
    setBusy(false);
    if (r.ok) {
      setMsg(`Invite emailed to ${email}.`);
      if (d.link) setInviteLink(d.link);
      setEmail("");
    } else {
      setMsg(d.error || "Couldn't send the invite.");
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  async function remove(member: Member) {
    if (
      !confirm(
        `Remove ${member.name || member.email} from the family? Their shared tasks become private again.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/family/remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: member.id }),
    });
    setBusy(false);
    if (r.ok) location.reload();
    else setMsg("Couldn't remove that member.");
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

  if (!household && !pro) {
    return (
      <div className="profile-form">
        <section className="profile-card">
          <h2 className="section">Nudge Family is a Pro feature</h2>
          <p className="note">
            Share tasks &amp; lists with the household, assign who does what, and
            everyone gets the nudge. Upgrade to set up your family.
          </p>
          <p>
            <Link href="/upgrade" className="btn-primary-lg">
              See nudge Pro
            </Link>
          </p>
        </section>
      </div>
    );
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
              {isOwner && m.id !== meId && (
                <button
                  className="link danger member-remove"
                  disabled={busy}
                  onClick={() => remove(m)}
                >
                  Remove
                </button>
              )}
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

        {inviteLink && (
          <div className="invite-link">
            <p className="note">
              📨 Emails sometimes land in junk — to be sure they get it, send this
              link directly (WhatsApp, text, anywhere):
            </p>
            <div className="invite-link-row">
              <input
                className="cal-url"
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button onClick={copyLink}>{copied ? "Copied ✓" : "Copy link"}</button>
            </div>
            <p className="note">They open it once signed in to Nudge. Expires in 7 days.</p>
          </div>
        )}
      </section>

      <section className="profile-card">
        <button onClick={leave} disabled={busy}>
          Leave family
        </button>
      </section>
    </div>
  );
}
