import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvite } from "@/lib/households";

export const runtime = "nodejs";

/** POST /api/family/join { token } — accept an invite for the signed-in user. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const result = await acceptInvite(token, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
