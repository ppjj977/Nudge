import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveFcmToken } from "@/lib/fcm";

export const runtime = "nodejs";

/** POST /api/push/fcm/register { token } — store a native FCM device token. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || token.length < 20) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  await saveFcmToken(user.id, token);
  return NextResponse.json({ ok: true });
}
