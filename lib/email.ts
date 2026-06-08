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
  // Brand the sender with a display name when the env only has a bare address.
  const from = config.email.from.includes("<")
    ? config.email.from
    : `nudge <${config.email.from}>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.email.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
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

/* -------------------------------------------------------------------------- */
/* Shared branded layout so every email looks like nudge.                      */
/* -------------------------------------------------------------------------- */

const BRAND = {
  green: "#7BAA94",
  amber: "#F5B52E",
  mint: "#CFE0D5",
  text: "#232A32",
  muted: "#667085",
  bg: "#F8F7F4",
  border: "#E9E9E3",
};

/**
 * Wrap email body HTML in the nudge shell: wordmark header, card, optional
 * branded CTA button, and the tagline footer. `heading` may contain safe
 * (already-escaped) inline HTML; `bodyHtml` is inserted as-is.
 */
export function emailShell(opts: {
  heading: string;
  intro?: string;
  bodyHtml?: string;
  ctaText?: string;
  ctaUrl?: string | null;
}): string {
  const { heading, intro, bodyHtml = "", ctaText, ctaUrl } = opts;
  const cta =
    ctaText && ctaUrl
      ? `<p style="margin:24px 0 0"><a href="${esc(ctaUrl)}" style="display:inline-block;background:${BRAND.green};color:#ffffff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:10px">${esc(ctaText)}</a></p>`
      : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:${BRAND.bg};padding:24px 16px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;padding:24px">
      <div style="display:flex;align-items:center;gap:8px">
        ${
          config.appBaseUrl
            ? `<img src="${config.appBaseUrl.replace(/\/$/, "")}/icon-192.png" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle"/>`
            : ""
        }
        <span style="font-weight:800;font-size:20px;letter-spacing:-0.3px;color:${BRAND.green};vertical-align:middle">nudge</span>
      </div>
      <h1 style="font-size:19px;line-height:1.3;color:${BRAND.text};margin:14px 0 6px">${heading}</h1>
      ${intro ? `<p style="color:${BRAND.muted};margin:0 0 10px;font-size:15px">${intro}</p>` : ""}
      ${bodyHtml}
      ${cta}
    </div>
    <div style="max-width:560px;margin:14px auto 0;text-align:center;color:${BRAND.muted};font-size:12px">a gentle nudge for everything that matters</div>
  </div>`;
}

export const emailBrand = BRAND;
