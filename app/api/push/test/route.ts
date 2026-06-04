import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { sendPushToUser, pushEnabled } from "@/lib/push";

export const runtime = "nodejs";

/** POST /api/push/test — send a test notification to the user's devices. */
export async function POST() {
  if (!pushEnabled()) {
    return NextResponse.json(
      { error: "Push not configured on the server (VAPID keys missing)" },
      { status: 503 },
    );
  }
  const user = await getOrCreateDefaultUser();
  const delivered = await sendPushToUser(user.id, {
    title: "🔔 nudge test",
    body: "Notifications are working. You'll be nudged before things are due.",
    url: "/",
  });
  return NextResponse.json({ delivered });
}
