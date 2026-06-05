import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeMember } from "@/lib/households";

export const runtime = "nodejs";

/** POST /api/family/remove { userId } — owner removes a family member. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetUserId = typeof body.userId === "string" ? body.userId : "";
  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const ok = await removeMember(user.id, targetUserId);
  if (!ok) {
    return NextResponse.json(
      { error: "Only the family owner can remove members." },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
