import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ingestAndExtract } from "@/lib/pipeline";
import { imageToText } from "@/lib/normalize";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Web Share Target handler (PWA). When an installed nudge receives a share from
 * the system share sheet, the browser POSTs the shared content here. We push it
 * through the same ingest pipeline as paste/upload, then redirect to the
 * timeline so the user sees the result. (SPEC §6 — one extraction path.)
 *
 * Configured in public/manifest.webmanifest under "share_target".
 */
export async function POST(req: Request) {
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "") || new URL(req.url).origin;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${base}/login`, 303);
  }
  const form = await req.formData().catch(() => null);

  let outcome: "added" | "nothing" | "failed" | "empty" = "empty";

  if (form) {
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/png";
      const ocr = await imageToText(buffer, mime);
      const res = await ingestAndExtract(user, {
        source: "image",
        rawContent: `image:${file.name || "shared"} (${mime}, ${buffer.length} bytes)`,
        normalizedText: ocr.text,
        meta: { via: "share", ocr_method: ocr.method, ocr_confidence: ocr.confidence ?? null },
      });
      outcome = res.status === "failed" ? "failed" : res.nothingActionable ? "nothing" : "added";
    } else {
      // Shared text and/or a link.
      const parts = [form.get("title"), form.get("text"), form.get("url")]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      const text = parts.join("\n");
      if (text.trim().length > 0) {
        const res = await ingestAndExtract(user, {
          source: "text",
          rawContent: text,
          normalizedText: text,
          meta: { via: "share" },
        });
        outcome = res.status === "failed" ? "failed" : res.nothingActionable ? "nothing" : "added";
      }
    }
  }

  // Redirect (303) so the browser lands on the timeline with a GET.
  // Do NOT build this from req.url — behind Render's proxy the server sees its
  // internal host (localhost:10000), which the browser can't reach. Use the
  // configured public base if set, otherwise a relative path (which the browser
  // resolves against the public URL it actually requested).
  const location = config.appBaseUrl
    ? `${base}/?shared=${outcome}`
    : `/?shared=${outcome}`;
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}
