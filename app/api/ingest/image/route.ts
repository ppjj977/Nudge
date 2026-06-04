import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { ingestAndExtract } from "@/lib/pipeline";
import { imageToText } from "@/lib/normalize";

export const runtime = "nodejs";
// OCR / vision can take a while; allow headroom.
export const maxDuration = 60;

/**
 * POST /api/ingest/image  (multipart/form-data, field "file")
 * Convert to text (vision model or OCR), store the text in normalized_text,
 * then extract (SPEC §6.3).
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "multipart form field 'file' is required" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";

  const ocr = await imageToText(buffer, mime);

  const user = await getOrCreateDefaultUser();
  const result = await ingestAndExtract(user, {
    source: "image",
    // Store a pointer/description rather than the raw bytes in the text column.
    rawContent: `image:${file.name || "upload"} (${mime}, ${buffer.length} bytes)`,
    normalizedText: ocr.text,
    meta: {
      filename: file.name,
      mime,
      ocr_method: ocr.method,
      ocr_confidence: ocr.confidence ?? null,
    },
  });

  return NextResponse.json(
    { ...result, ocr: { method: ocr.method, confidence: ocr.confidence } },
    { status: result.status === "failed" ? 422 : 200 },
  );
}
