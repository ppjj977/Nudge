import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateItem, deleteItem } from "@/lib/lists";

export const runtime = "nodejs";

/** PATCH /api/lists/[id]/items/[itemId] — tick/untick or rename an item. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ok = await updateItem(user.id, id, itemId, {
    done: typeof body.done === "boolean" ? body.done : undefined,
    text: typeof body.text === "string" ? body.text : undefined,
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/lists/[id]/items/[itemId] — remove an item. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;
  const ok = await deleteItem(user.id, id, itemId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
