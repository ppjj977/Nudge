import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dismissCapture } from "@/lib/captures";

export const runtime = "nodejs";

/** DELETE /api/captures?id=… — dismiss a capture that made no task ("no action needed"). */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await dismissCapture(user.id, id);
  return NextResponse.json({ ok: true });
}
