import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addItem } from "@/lib/lists";

export const runtime = "nodejs";

/** POST /api/lists/[id]/items — add an item { text }. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const item = await addItem(user.id, id, text);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item, { status: 201 });
}
