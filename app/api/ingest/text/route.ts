import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { ingestAndExtract } from "@/lib/pipeline";

export const runtime = "nodejs";

/** POST /api/ingest/text  { text }  — paste capture (SPEC §6.2, §10). */
export async function POST(req: Request) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const user = await getOrCreateDefaultUser();
  const result = await ingestAndExtract(user, {
    source: "text",
    rawContent: text,
    normalizedText: text,
  });

  return NextResponse.json(result, {
    status: result.status === "failed" ? 422 : 200,
  });
}
