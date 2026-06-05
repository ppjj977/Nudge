"use client";

import { useEffect } from "react";

/** App-level error boundary — friendly page instead of a raw white screen. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        context: "page",
        message: `${error.message}${error.digest ? ` (digest ${error.digest})` : ""}`,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="error-page">
      <h1>Something went wrong</h1>
      <p className="note">
        A gremlin got in. We&apos;ve been notified — give it another go.
      </p>
      <div className="hero-cta">
        <button className="btn-primary-lg" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn-ghost-lg" href="/">
          Go home
        </a>
      </div>
    </div>
  );
}
