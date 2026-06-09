import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { setPlanById } from "@/lib/plan";

export const runtime = "nodejs";

/** POST /api/admin/plan { userId, pro } — comp/revoke a user's Pro. Admin only. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { userId, pro } = await req.json().catch(() => ({}));
  if (typeof userId !== "string" || typeof pro !== "boolean") {
    return NextResponse.json({ error: "userId and pro required" }, { status: 400 });
  }
  await setPlanById(userId, pro);
  return NextResponse.json({ ok: true });
}
