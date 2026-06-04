import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { ingestAndExtract } from "@/lib/pipeline";
import { transcribeAudio } from "@/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ingest/audio  (multipart/form-data, field "file")
 * Transcribe a voice note, then extract — one note can become several tasks.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "multipart form field 'file' (audio) is required" },
      { status: 400 },
    );
  }

  let transcript: string;
  try {
    transcript = await transcribeAudio(file);
  } catch (err) {
    return NextResponse.json(
      { error: `Transcription failed: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  const user = await getOrCreateDefaultUser();
  const result = await ingestAndExtract(user, {
    source: "audio",
    rawContent: `audio:${file.name || "voice-note"} (${file.type}, ${file.size} bytes)`,
    normalizedText: transcript,
    meta: { via: "voice", transcript },
  });

  return NextResponse.json(
    { ...result, transcript },
    { status: result.status === "failed" ? 422 : 200 },
  );
}
