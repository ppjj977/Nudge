"use client";

import { useState } from "react";

interface Row {
  id: string;
  email: string;
  name: string | null;
  pro: boolean;
  plan_source: string | null;
  created_at: string;
}

export default function AdminUsers({ users }: { users: Row[] }) {
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function toggle(id: string, pro: boolean) {
    setBusy(id);
    const r = await fetch("/api/admin/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id, pro }),
    });
    setBusy(null);
    if (r.ok) {
      setRows((rs) =>
        rs.map((u) => (u.id === id ? { ...u, pro, plan_source: pro ? "comp" : "admin-revoke" } : u)),
      );
    }
  }

  const filtered = q
    ? rows.filter((u) => (u.email + " " + (u.name ?? "")).toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <section className="panel">
      <h2 className="section">All users ({rows.length})</h2>
      <input
        className="user-search"
        placeholder="Search name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="user-list">
        {filtered.map((u) => (
          <div className="user-row" key={u.id}>
            <div className="user-id">
              <b>{u.name || u.email}</b>
              {u.name && <span className="note">{u.email}</span>}
              <span className="note">
                joined {new Date(u.created_at).toLocaleDateString()}
                {u.pro && u.plan_source ? ` · ${u.plan_source}` : ""}
              </span>
            </div>
            <span className={`chip ${u.pro ? "pro-on" : ""}`}>{u.pro ? "Pro" : "Free"}</span>
            <button
              className={u.pro ? "" : "primary"}
              disabled={busy === u.id}
              onClick={() => toggle(u.id, !u.pro)}
            >
              {busy === u.id ? "…" : u.pro ? "Revoke" : "Make Pro"}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="note">No matching users.</p>}
      </div>
    </section>
  );
}
