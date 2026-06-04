import Groq from "groq-sdk";
import { config } from "./config";

/**
 * All three capture sources normalize to plain text before extraction, so the
 * extraction path is identical (SPEC §6, §2). This module is that funnel.
 */

/** Collapse runaway whitespace while preserving paragraph breaks. */
export function tidyText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ") // nbsp
    .replace(/[ \t]{2,}/g, " ") // collapse intra-line runs (e.g. from HTML strip)
    .replace(/[ \t]+\n/g, "\n") // trailing spaces
    .replace(/\n[ \t]+/g, "\n") // leading spaces
    .replace(/\n{3,}/g, "\n\n") // collapse blank runs
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

// Lines that mark the start of a quoted reply chain. Everything after is dropped.
const QUOTE_MARKERS: RegExp[] = [
  /^On .+ wrote:$/i, // "On Tue, 3 Jun 2026 ... wrote:"
  /^-{2,}\s*Original Message\s*-{2,}/i,
  /^_{5,}/, // Outlook divider
  /^From:\s.+/i, // forwarded header block
  /^Sent from my /i,
];

// Common signature delimiter.
const SIG_DELIM = /^--\s*$/;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

export interface EmailInput {
  subject?: string;
  text?: string;
  html?: string;
}

/**
 * Reduce a forwarded email to the actionable body: strip quoted reply chains
 * and signatures "where cheaply possible" (SPEC §6.1). Keep the subject — it
 * usually carries the headline action.
 */
export function normalizeEmail(email: EmailInput): string {
  const bodySource =
    email.text && email.text.trim().length > 0
      ? email.text
      : email.html
        ? stripHtml(email.html)
        : "";

  const lines = bodySource.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (QUOTE_MARKERS.some((re) => re.test(trimmed))) break;
    if (SIG_DELIM.test(trimmed)) break;
    if (trimmed.startsWith(">")) continue; // quoted line
    kept.push(line);
  }

  const subject = email.subject?.trim();
  const body = tidyText(kept.join("\n"));
  return tidyText([subject ? `Subject: ${subject}` : "", body].join("\n\n"));
}

/* -------------------------------------------------------------------------- */
/* Image -> text                                                               */
/* -------------------------------------------------------------------------- */

export interface ImageToTextResult {
  text: string;
  /** How the text was produced, recorded in captures.meta. */
  method: "groq-vision" | "tesseract";
  /** OCR confidence 0..1 when available (Tesseract only). */
  confidence?: number;
}

/**
 * Convert an image to text. Prefer a Groq vision model if GROQ_VISION_MODEL is
 * configured; otherwise fall back to local Tesseract OCR (SPEC §13 decision 2).
 * Both paths produce plain text for the identical extraction path.
 */
export async function imageToText(
  buffer: Buffer,
  mimeType: string,
): Promise<ImageToTextResult> {
  if (config.groq.visionModel && config.groq.apiKey) {
    try {
      const text = await groqVisionOcr(buffer, mimeType);
      return { text: tidyText(text), method: "groq-vision" };
    } catch {
      // Fall through to OCR rather than failing the capture.
    }
  }
  const { text, confidence } = await tesseractOcr(buffer);
  return { text: tidyText(text), method: "tesseract", confidence };
}

async function groqVisionOcr(buffer: Buffer, mimeType: string): Promise<string> {
  const client = new Groq({ apiKey: config.groq.apiKey });
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const completion = await client.chat.completions.create({
    model: config.groq.visionModel as string,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe ALL text visible in this image verbatim, preserving line breaks. Do not summarise, explain, or add commentary. Output only the transcribed text.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

/* -------------------------------------------------------------------------- */
/* Audio -> text (voice notes)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Transcribe a voice note with Groq Whisper. The transcript then runs through
 * the normal extraction path, so one note can yield several tasks (SPEC §6).
 */
export async function transcribeAudio(file: File | Blob): Promise<string> {
  if (!config.groq.apiKey) {
    throw new Error("GROQ_API_KEY is not set; cannot transcribe audio.");
  }
  const client = new Groq({ apiKey: config.groq.apiKey });
  const res = await client.audio.transcriptions.create({
    file: file as File,
    model: config.groq.whisperModel,
  });
  return (res.text ?? "").trim();
}

async function tesseractOcr(
  buffer: Buffer,
): Promise<{ text: string; confidence: number }> {
  // Lazy import so the heavy worker only loads on the image path.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return { text: data.text, confidence: (data.confidence ?? 0) / 100 };
  } finally {
    await worker.terminate();
  }
}
