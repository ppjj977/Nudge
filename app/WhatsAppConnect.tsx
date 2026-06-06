"use client";

import { useState } from "react";

export default function WhatsAppConnect({
  connected,
  maskedNumber,
  code,
  deepLink,
  displayNumber,
}: {
  connected: boolean;
  maskedNumber: string | null;
  code: string;
  deepLink: string | null;
  displayNumber: string | null;
}) {
  const [isConnected, setConnected] = useState(connected);
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!confirm("Disconnect WhatsApp from Nudge?")) return;
    setBusy(true);
    const r = await fetch("/api/whatsapp/link", { method: "DELETE" });
    setBusy(false);
    if (r.ok) setConnected(false);
  }

  return (
    <section className="panel wa-connect">
      <h2 className="section">WhatsApp capture</h2>

      {isConnected ? (
        <>
          <p className="note">
            ✅ Connected{maskedNumber ? ` · ${maskedNumber}` : ""}. Forward any message,
            photo or voice note to Nudge on WhatsApp and it becomes a reminder.
          </p>
          <button className="link wa-disconnect" onClick={disconnect} disabled={busy}>
            Disconnect WhatsApp
          </button>
        </>
      ) : (
        <>
          <p className="note">
            Send things to Nudge straight from WhatsApp — a class-group message, a photo
            of a letter, a quick voice note. Connect once:
          </p>
          <ol className="wa-steps">
            <li>
              Tap <b>Connect</b> below (or message{" "}
              <b>{displayNumber ? `+${displayNumber}` : "the Nudge number"}</b> on WhatsApp).
            </li>
            <li>
              Send the code <code className="wa-code">NUDGE-{code}</code> — we&apos;ll reply
              to confirm.
            </li>
          </ol>
          {deepLink ? (
            <a className="btn-primary-lg wa-cta" href={deepLink} target="_blank" rel="noreferrer">
              Connect WhatsApp
            </a>
          ) : (
            <p className="note">
              WhatsApp isn&apos;t fully configured yet — message the Nudge number with{" "}
              <code className="wa-code">NUDGE-{code}</code> once it&apos;s live.
            </p>
          )}
        </>
      )}
    </section>
  );
}
