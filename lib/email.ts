import { config } from "./config";

/**
 * Transactional email via Resend (SPEC §13 decision 4). Uses the REST API
 * directly to avoid an extra dependency. If RESEND_API_KEY is unset, logs and
 * skips rather than throwing, so local/dev runs without email don't crash.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (!config.email.resendApiKey) {
    console.warn(`[email] RESEND_API_KEY unset — skipping email to ${msg.to}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.email.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.email.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] Resend ${res.status}: ${body}`);
    return false;
  }
  return true;
}

/** Minimal HTML escaping for user-derived strings in emails. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
