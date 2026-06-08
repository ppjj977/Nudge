import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { findUserByInboundLocalPart } from "@/lib/users";
import { cleanForwardedEmail } from "@/lib/normalize";
import { ingestAndExtract } from "@/lib/pipeline";
import { createManualTask } from "@/lib/tasks";
import { sendPushToUser } from "@/lib/push";
import { sendFcmToUser } from "@/lib/fcm";
import { parseFirstEvent, extractVCalendar } from "@/lib/ical";

export const runtime = "nodejs";

/** Confirm a forwarded email landed: push "N tasks added" → the Recent view. */
async function notifyTasksAdded(userId: string, titles: string[]): Promise<void> {
  if (titles.length === 0) return;
  const n = titles.length;
  const payload = {
    title: `✅ ${n} ${n === 1 ? "task" : "tasks"} added from your email`,
    body: titles.slice(0, 3).join(" · "),
    url: "/recent",
  };
  await sendPushToUser(userId, payload).catch(() => 0);
  await sendFcmToUser(userId, payload).catch(() => 0);
}

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
      const present = [...req.headers.keys()].filter((h) => /svix|webhook/i.test(h));
      console.warn("[inbound] signature check failed", { present });
      return NextResponse.json(
        { error: "Bad signature", reason: "signature", headers: present },
        { status: 401 },
      );
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
  const dataKeys = Object.keys(data);
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
    console.warn("[inbound] no matching recipient", { to: recipients, domain });
    return NextResponse.json({ ok: true, ignored: "no-recipient", to: recipients });
  }

  const user = await findUserByInboundLocalPart(localPart);
  if (!user) {
    console.warn("[inbound] unknown inbound address", { localPart });
    return NextResponse.json({ ok: true, ignored: "unknown-address", localPart });
  }

  const subject = (data.subject ?? "").trim();

  // The webhook sometimes carries only metadata; fetch the full body if needed.
  let text = (data.text ?? "").trim();
  let html = data.html ?? "";
  let fetched = false;
  if (!text && !html && data.email_id) {
    const got = await fetchInboundBody(data.email_id);
    if (got) {
      text = (got.text ?? "").trim();
      html = got.html ?? "";
      fetched = true;
    }
  }
  const body = cleanForwardedEmail(text || htmlToText(html));
  const from = extractEmail(data.from);
  const normalizedText = [subject ? `Subject: ${subject}` : "", body]
    .filter(Boolean)
    .join("\n\n");

  // Calendar invite? Parse the .ics for an exact event instead of guessing from
  // prose — gives the precise date/time/timezone. (Falls back to AI below.)
  const ics = findCalendar(data, text, html);
  if (ics) {
    const evt = parseFirstEvent(ics, user.timezone);
    if (evt) {
      const task = await createManualTask(user.id, {
        title: evt.title && evt.title !== "Event" ? evt.title : subject || "Event",
        category: "attend",
        detail: evt.detail,
        due_at: evt.due_at,
        due_type: evt.due_type,
        end_at: evt.end_at,
        location: evt.location,
      });
      const diag = {
        ok: true,
        matchedUser: user.id,
        calendarEvent: true,
        taskId: task.id,
        due_at: task.due_at,
      };
      await notifyTasksAdded(user.id, [task.title]);
      console.log("[inbound] calendar event", diag);
      return NextResponse.json(diag);
    }
  }

  const result = await ingestAndExtract(user, {
    source: "email",
    rawContent: raw,
    normalizedText,
    meta: { from, subject, to: recipients },
  });

  const diag = {
    ok: true,
    matchedUser: user.id,
    dataKeys,
    bodyChars: body.length,
    bodyFetched: fetched,
    captureId: result.captureId,
    status: result.status,
    nothingActionable: result.nothingActionable,
    tasks: result.tasks.length,
    error: result.error,
  };
  await notifyTasksAdded(user.id, result.tasks.map((t) => t.title));
  console.log("[inbound] processed", diag);
  return NextResponse.json(diag);
}

/** Resend's inbound webhook may omit the body; fetch it by id from the API. */
async function fetchInboundBody(
  emailId: string,
): Promise<{ text?: string; html?: string } | null> {
  if (!config.email.resendApiKey) return null;
  for (const url of [
    `https://api.resend.com/emails/receiving/${emailId}`,
    `https://api.resend.com/emails/${emailId}`,
  ]) {
    try {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${config.email.resendApiKey}` },
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { text?: string; html?: string };
      if (j.text || j.html) return { text: j.text, html: j.html };
    } catch {
      /* try next */
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */

interface InboundAttachment {
  filename?: string;
  content_type?: string;
  contentType?: string;
  content?: string; // base64 (or raw .ics text)
}
interface InboundEmail {
  from?: string | { email?: string; name?: string };
  to?: string | string[] | Array<{ email?: string }>;
  subject?: string;
  text?: string;
  html?: string;
  email_id?: string;
  attachments?: InboundAttachment[];
}

/** Find iCalendar content: inline in the body, or in a .ics/text-calendar
 *  attachment (decoding base64 when needed). Returns the VCALENDAR text. */
function findCalendar(data: InboundEmail, text: string, html: string): string | null {
  const inline = extractVCalendar(text) || extractVCalendar(html);
  if (inline) return inline;
  for (const a of data.attachments ?? []) {
    const ct = (a.content_type || a.contentType || "").toLowerCase();
    const fn = (a.filename || "").toLowerCase();
    if (!ct.includes("calendar") && !fn.endsWith(".ics")) continue;
    const content = a.content;
    if (typeof content !== "string" || !content) continue;
    if (content.includes("BEGIN:VCALENDAR")) return extractVCalendar(content);
    try {
      const decoded = Buffer.from(content, "base64").toString("utf8");
      if (decoded.includes("BEGIN:VCALENDAR")) return extractVCalendar(decoded);
    } catch {
      /* not base64 — skip */
    }
  }
  return null;
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
