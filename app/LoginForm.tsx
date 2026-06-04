"use client";

import { useState } from "react";

export default function LoginForm({
  googleEnabled,
  initialMessage,
}: {
  googleEnabled: boolean;
  initialMessage?: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(initialMessage ?? null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true);
    setMsg(null);
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok, d } as { ok: boolean; d: { error?: string } };
  }

  async function login() {
    const { ok, d } = await post("/api/auth/login", { email, password });
    if (ok) location.href = "/";
    else setMsg(d.error || "Sign in failed");
  }
  async function register() {
    const { ok, d } = await post("/api/auth/register", { name, email, password });
    if (ok) location.href = "/";
    else setMsg(d.error || "Could not create account");
  }
  async function magic() {
    if (!email.includes("@")) {
      setMsg("Enter your email first");
      return;
    }
    const { ok } = await post("/api/auth/request", { email });
    setMsg(
      ok
        ? "Check your email for a sign-in link (it expires in 15 minutes)."
        : "Couldn't send the link.",
    );
  }

  return (
    <div className="auth">
      {googleEnabled && (
        <a className="btn-google" href="/api/auth/google/start">
          Continue with Google
        </a>
      )}
      {googleEnabled && <div className="auth-divider">or</div>}

      <label className="field">
        <span>Name (for new accounts)</span>
        <input
          type="text"
          value={name}
          autoComplete="name"
          placeholder="Optional"
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
        <span>Password</span>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <div className="auth-actions">
        <button className="primary" onClick={login} disabled={busy}>
          Sign in
        </button>
        <button onClick={register} disabled={busy}>
          Create account
        </button>
      </div>
      <button className="link" onClick={magic} disabled={busy}>
        Email me a sign-in link instead
      </button>

      {msg && <p className="note auth-msg">{msg}</p>}
    </div>
  );
}
