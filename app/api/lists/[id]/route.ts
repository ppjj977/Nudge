import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateList, deleteList } from "@/lib/lists";

export const runtime = "nodejs";

/** PATCH /api/lists/[id] — rename or toggle sharing. */
export async function PATCH(
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
  const ok = await updateList(user.id, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    shared: typeof body.shared === "boolean" ? body.shared : undefined,
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/lists/[id] — remove a list and its items. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteList(user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
