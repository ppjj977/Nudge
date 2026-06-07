"use client";

import { useState } from "react";

export default function CalendarSubscribe({
  webcalUrl,
  httpsUrl,
}: {
  webcalUrl: string;
  httpsUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <section className="panel">
      <h2 className="section">Calendar feed</h2>
      <p className="note">
        Subscribe to your Nudge reminders in Google, Apple or Outlook calendar — dated
        tasks show up automatically and refresh through the day.
      </p>
      <div className="cal-row">
        <a className="btn-primary-lg cal-cta" href={webcalUrl}>
          Add to calendar
        </a>
        <button onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
      </div>
      <input className="cal-url" readOnly value={httpsUrl} onFocus={(e) => e.currentTarget.select()} />
      <p className="note">
        Tip: in Google Calendar use <b>Other calendars → From URL</b> and paste this link.
        Keep it private — anyone with the link can see your reminders.
      </p>
    </section>
  );
}
