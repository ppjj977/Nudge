import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { findUserByInboundLocalPart } from "@/lib/users";
import { ingestAndExtract } from "@/lib/pipeline";

export const runtime = "nodejs";

/**
 * Email-in (SPEC §3). Resend posts a signed webhook here when mail arrives at a
 * per-user address (e.g. nudge-ab12@in.nudgelive.co.uk). We verify the Svix
 * signature, match the recipient to a user, and run the body through the same
 * extraction pipeline as every other capture.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  // --- verify signature (Svix scheme used by Resend) ---
  const secret = config.inbound.webhookSecret;
  if (secret) {
    const ok = verifySvix(secret, req.headers, raw);
    if (!ok) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else {
    console.warn("[inbound] INBOUND_WEBHOOK_SECRET unset — skipping verification");
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(raw) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only act on received-email events; ack everything else so Resend won't retry.
  const type = payload.type ?? "";
  if (type && !/received|inbound/i.test(type)) {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const data = payload.data ?? (payload as unknown as InboundEmail);
  const recipients = toList(data.to);
  const domain = config.inbound.domain?.toLowerCase();

  // Find the recipient that belongs to us and map it to a user.
  let localPart: string | null = null;
  for (const r of recipients) {
    const addr = extractEmail(r).toLowerCase();
    const at = addr.lastIndexOf("@");
    if (at < 0) continue;
    const local = addr.slice(0, at);
    const dom = addr.slice(at + 1);
    if (!domain || dom === domain) {
      localPart = local;
      break;
    }
  }
  if (!localPart) {
    console.warn("[inbound] no matching recipient", { to: recipients });
    return NextResponse.json({ ok: true, ignored: "no-recipient" });
  }

  const user = await findUserByInboundLocalPart(localPart);
  if (!user) {
    console.warn("[inbound] unknown inbound address", { localPart });
    return NextResponse.json({ ok: true, ignored: "unknown-address" });
  }

  const subject = (data.subject ?? "").trim();
  const body = (data.text ?? "").trim() || htmlToText(data.html ?? "");
  const from = extractEmail(data.from);
  const normalizedText = [subject, body].filter(Boolean).join("\n\n");

  const result = await ingestAndExtract(user, {
    source: "email",
    rawContent: raw,
    normalizedText,
    meta: { from, subject, to: recipients },
  });

  return NextResponse.json({ ok: true, captureId: result.captureId });
}

/* -------------------------------------------------------------------------- */

interface InboundEmail {
  from?: string | { email?: string; name?: string };
  to?: string | string[] | Array<{ email?: string }>;
  subject?: string;
  text?: string;
  html?: string;
}
interface InboundPayload {
  type?: string;
  data?: InboundEmail;
}

function toList(to: InboundEmail["to"]): string[] {
  if (!to) return [];
  if (typeof to === "string") return [to];
  return to.map((t) => (typeof t === "string" ? t : (t.email ?? ""))).filter(Boolean);
}

/** Pull the bare address out of "Name <a@b.com>" or {email}. */
function extractEmail(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object" && v !== null && "email" in v) {
    return String((v as { email?: string }).email ?? "");
  }
  const s = String(v);
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Svix webhook verification (https://docs.svix.com/receiving/verifying-payloads).
 * secret is "whsec_<base64>"; signed content is "<id>.<timestamp>.<body>".
 */
function verifySvix(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const sigHeader = headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // Header is space-separated "v1,<sig>" entries.
  for (const part of sigHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}
