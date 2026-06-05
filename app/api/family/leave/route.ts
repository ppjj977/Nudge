import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { leaveHousehold } from "@/lib/households";

export const runtime = "nodejs";

/** POST /api/family/leave — remove the signed-in user from their household. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await leaveHousehold(user.id);
  return NextResponse.json({ ok: true });
}
