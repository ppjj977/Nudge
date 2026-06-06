import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { config } from "@/lib/config";
import { ingestAndExtract, type IngestResult } from "@/lib/pipeline";
import { imageToText, transcribeAudio } from "@/lib/normalize";
import {
  verifyMetaSignature,
  sendWhatsAppText,
  fetchWhatsAppMedia,
  findUserByWhatsApp,
  tryLinkFromText,
} from "@/lib/whatsapp";
import type { User } from "@/lib/users";

export const runtime = "nodejs";
// Media fetch + OCR / transcription can take a while.
export const maxDuration = 60;

/* Meta retries deliveries until it gets a 200; dedupe by message id so a retry
 * (or a slow ack) doesn't create duplicate tasks. Process-local LRU is fine for
 * a single Render instance. */
const seenIds = new Set<string>();
function alreadySeen(id: string): boolean {
  if (seenIds.has(id)) return true;
  seenIds.add(id);
  if (seenIds.size > 1000) seenIds.delete(seenIds.values().next().value as string);
  return false;
}

/* -------------------------------------------------------------------------- */
/* GET — webhook verification handshake                                        */
/* -------------------------------------------------------------------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && token && token === config.whatsapp.verifyToken) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/* -------------------------------------------------------------------------- */
/* POST — inbound messages                                                     */
/* -------------------------------------------------------------------------- */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // WhatsApp batches messages under entry[].changes[].value.messages[].
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        try {
          await handleMessage(msg);
        } catch (err) {
          console.error("[whatsapp] handler error", (err as Error).message);
        }
      }
    }
  }

  // Always 200 so Meta doesn't retry storms; per-message errors are logged.
  return NextResponse.json({ ok: true });
}

async function handleMessage(msg: WaMessage): Promise<void> {
  if (!msg.id || alreadySeen(msg.id)) return;
  const from = msg.from;
  if (!from) return;

  let user = await findUserByWhatsApp(from);

  // Unlinked sender: try to interpret a NUDGE-XXXX link code, else guide them.
  if (!user) {
    const text = msg.text?.body ?? msg.image?.caption ?? "";
    const linked = text ? await tryLinkFromText(text, from) : null;
    if (linked) {
      await sendWhatsAppText(
        from,
        "✅ Connected! Your WhatsApp is now linked to Nudge. Forward me anything — a message, a photo of a letter, or a voice note — and I'll turn it into reminders.",
      );
      return;
    }
    await sendWhatsAppText(
      from,
      "👋 This is Nudge. To link your account, open the Nudge app → Settings → Connect WhatsApp, then send me the code shown there.",
    );
    return;
  }

  // Linked sender → capture by message type.
  const result = await captureMessage(user, msg);
  if (!result) {
    await sendWhatsAppText(
      from,
      "I can read text messages, photos (e.g. a school letter or bill) and voice notes. Try forwarding me one of those 🙂",
    );
    return;
  }
  await sendWhatsAppText(from, summarise(result, user));
}

/** Route a WhatsApp message into the shared ingest pipeline by its type. */
async function captureMessage(user: User, msg: WaMessage): Promise<IngestResult | null> {
  if (msg.type === "text" && msg.text?.body) {
    return ingestAndExtract(user, {
      source: "text",
      rawContent: msg.text.body,
      normalizedText: msg.text.body,
      meta: { via: "whatsapp", from: msg.from },
    });
  }

  if (msg.type === "image" && msg.image?.id) {
    const media = await fetchWhatsAppMedia(msg.image.id);
    if (!media) return null;
    const ocr = await imageToText(media.buffer, media.mime);
    const caption = msg.image.caption?.trim();
    const text = [caption, ocr.text].filter(Boolean).join("\n\n");
    return ingestAndExtract(user, {
      source: "image",
      rawContent: `whatsapp-image (${media.mime}, ${media.buffer.length} bytes)`,
      normalizedText: text,
      meta: { via: "whatsapp", ocr_method: ocr.method, caption: caption ?? null },
    });
  }

  if ((msg.type === "audio" || msg.type === "voice") && (msg.audio?.id || msg.voice?.id)) {
    const mediaId = (msg.audio?.id ?? msg.voice?.id)!;
    const media = await fetchWhatsAppMedia(mediaId);
    if (!media) return null;
    const file = new File([new Uint8Array(media.buffer)], "voice.ogg", { type: media.mime });
    let transcript = "";
    try {
      transcript = await transcribeAudio(file);
    } catch (err) {
      console.error("[whatsapp] transcription failed", (err as Error).message);
      return null;
    }
    return ingestAndExtract(user, {
      source: "audio",
      rawContent: `whatsapp-voice (${media.mime}, ${media.buffer.length} bytes)`,
      normalizedText: transcript,
      meta: { via: "whatsapp", transcript },
    });
  }

  return null;
}

/** Build a friendly confirmation reply from the ingest result. */
function summarise(result: IngestResult, user: User): string {
  if (result.status === "limit") {
    const lim = result.limit?.limit ?? 0;
    return `You've used all ${lim} free captures this month 🙈 Upgrade to Nudge Pro for unlimited capture: ${baseUrl()}/upgrade`;
  }
  if (result.status === "failed") {
    return "Hmm, I couldn't read that one. Try sending it as plain text and I'll have another go.";
  }
  if (result.nothingActionable || result.tasks.length === 0) {
    return "Got it — but I didn't spot anything that needed a reminder. Nothing lost; it's saved.";
  }

  const zone = user.timezone || "Europe/London";
  const lines = result.tasks.slice(0, 5).map((t) => {
    const due = t.due_at
      ? DateTime.fromISO(t.due_at).setZone(zone).toFormat(
          t.due_type === "datetime" ? "ccc d LLL HH:mm" : "ccc d LLL",
        )
      : null;
    return `• ${t.title}${due ? ` — ${due}` : ""}`;
  });
  const more = result.tasks.length > 5 ? `\n…and ${result.tasks.length - 5} more` : "";
  const head = result.tasks.length === 1 ? "✅ Added 1 reminder:" : `✅ Added ${result.tasks.length} reminders:`;
  return `${head}\n${lines.join("\n")}${more}`;
}

function baseUrl(): string {
  return (config.appBaseUrl ?? "https://nudgelive.co.uk").replace(/\/$/, "");
}

/* ----------------------------- webhook types ------------------------------ */
interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
  voice?: { id?: string; mime_type?: string };
}
interface WebhookChange {
  value?: { messages?: WaMessage[] };
}
interface WebhookEntry {
  changes?: WebhookChange[];
}
interface WebhookPayload {
  entry?: WebhookEntry[];
}
