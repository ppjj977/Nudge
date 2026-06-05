"use client";

import { useState } from "react";
import Link from "next/link";

export default function AuthForm({
  mode,
  googleEnabled,
  initialMessage,
}: {
  mode: "signin" | "signup";
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
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    return { ok: r.ok, d };
  }

  async function signin() {
    const { ok, d } = await post("/api/auth/login", { email, password });
    if (ok) location.href = "/";
    else setMsg(d.error || "Sign in failed");
  }
  async function signup() {
    if (!name.trim()) {
      setMsg("Please enter your name.");
      return;
    }
    const { ok, d } = await post("/api/auth/register", { name, email, password });
    if (ok) location.href = "/";
    else setMsg(d.error || "Could not create account");
  }
  async function magic() {
    if (!email.includes("@")) {
      setMsg("Enter your email first, then tap this.");
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

      {mode === "signup" && (
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
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
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {mode === "signin" ? (
        <>
          <button className="primary auth-submit" onClick={signin} disabled={busy}>
            Sign in
          </button>
          <button className="link" onClick={magic} disabled={busy}>
            Forgot your password? Email me a sign-in link
          </button>
          <p className="auth-foot">
            New to nudge? <Link href="/signup">Create an account</Link>
          </p>
        </>
      ) : (
        <>
          <button className="primary auth-submit" onClick={signup} disabled={busy}>
            Create account
          </button>
          <p className="auth-foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </>
      )}

      {msg && <p className="note auth-msg">{msg}</p>}
    </div>
  );
}
