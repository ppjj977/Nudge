import { createHmac, timingSafeEqual, randomInt } from "node:crypto";
import { db, ensureSchema } from "./db";
import { config } from "./config";
import type { User } from "./users";

/**
 * WhatsApp Cloud API helpers (capture channel). Users forward messages, photos
 * and voice notes to the Nudge business number; the webhook (app/api/whatsapp)
 * verifies them and runs them through the same extraction pipeline as every
 * other capture. Sending replies is free within the 24-hour customer-service
 * window opened by the user's inbound message, so no message templates needed.
 */

const GRAPH = "https://graph.facebook.com";

function graphUrl(path: string): string {
  return `${GRAPH}/${config.whatsapp.graphVersion}/${path}`;
}

/** Reduce any phone string to bare E.164 digits (no +, spaces or punctuation). */
export function normalizeNumber(raw: string): string {
  return (raw || "").replace(/\D+/g, "");
}

/* -------------------------------------------------------------------------- */
/* Webhook signature                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with
 * the app secret). Returns true when no secret is configured so local/dev still
 * works, but logs a warning.
 */
export function verifyMetaSignature(raw: string, header: string | null): boolean {
  const secret = config.whatsapp.appSecret;
  if (!secret) {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET unset — skipping signature check");
    return true;
  }
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Sending + media                                                             */
/* -------------------------------------------------------------------------- */

/** Send a plain-text WhatsApp message (within the 24h service window). */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const { accessToken, phoneNumberId } = config.whatsapp;
  if (!accessToken || !phoneNumberId) {
    console.warn("[whatsapp] cannot send — access token / phone number id unset");
    return;
  }
  try {
    const res = await fetch(graphUrl(`${phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4000) },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] send failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[whatsapp] send error", (err as Error).message);
  }
}

export interface WhatsAppMedia {
  buffer: Buffer;
  mime: string;
}

/** Resolve a media id to its bytes (two-step: metadata → signed URL → bytes). */
export async function fetchWhatsAppMedia(mediaId: string): Promise<WhatsAppMedia | null> {
  const { accessToken } = config.whatsapp;
  if (!accessToken) return null;
  try {
    const metaRes = await fetch(graphUrl(mediaId), {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const binRes = await fetch(meta.url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!binRes.ok) return null;
    const buffer = Buffer.from(await binRes.arrayBuffer());
    return { buffer, mime: meta.mime_type || "application/octet-stream" };
  } catch (err) {
    console.error("[whatsapp] media fetch error", (err as Error).message);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Account linking (number <-> user)                                           */
/* -------------------------------------------------------------------------- */

/** Unambiguous alphabet (no 0/O/1/I) for human-typed link codes. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** The user's stable link code, generated on first use. */
export async function getOrCreateLinkCode(user: Pick<User, "id" | "whatsapp_link_code">): Promise<string> {
  await ensureSchema();
  if (user.whatsapp_link_code) return user.whatsapp_link_code;
  // Retry on the (tiny) chance of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const clash = await db.execute({
      sql: "SELECT 1 FROM users WHERE whatsapp_link_code = ? LIMIT 1",
      args: [code],
    });
    if (clash.rows.length) continue;
    await db.execute({
      sql: "UPDATE users SET whatsapp_link_code = ? WHERE id = ?",
      args: [code, user.id],
    });
    return code;
  }
  throw new Error("could not allocate a WhatsApp link code");
}

export async function findUserByWhatsApp(number: string): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE whatsapp_number = ? LIMIT 1",
    args: [normalizeNumber(number)],
  });
  return res.rows.length ? (res.rows[0] as unknown as User) : null;
}

/**
 * Try to interpret an inbound message as a "link my number" request. Returns
 * the now-linked user when a `NUDGE-XXXX` code in the text matches, else null.
 */
export async function tryLinkFromText(text: string, fromNumber: string): Promise<User | null> {
  const m = text.match(/NUDGE-([A-Z0-9]{4})/i);
  if (!m) return null;
  const code = m[1].toUpperCase();
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE whatsapp_link_code = ? LIMIT 1",
    args: [code],
  });
  if (!res.rows.length) return null;
  const user = res.rows[0] as unknown as User;
  await db.execute({
    sql: "UPDATE users SET whatsapp_number = ? WHERE id = ?",
    args: [normalizeNumber(fromNumber), user.id],
  });
  return { ...user, whatsapp_number: normalizeNumber(fromNumber) };
}

/** Disconnect a user's WhatsApp number (from Settings). */
export async function unlinkWhatsApp(userId: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: "UPDATE users SET whatsapp_number = NULL WHERE id = ?",
    args: [userId],
  });
}

/** The wa.me deep-link that opens WhatsApp pre-addressed with the link code. */
export function linkDeepLink(code: string): string | null {
  const num = config.whatsapp.displayNumber;
  if (!num) return null;
  const text = encodeURIComponent(`Link my Nudge: NUDGE-${code}`);
  return `https://wa.me/${normalizeNumber(num)}?text=${text}`;
}
