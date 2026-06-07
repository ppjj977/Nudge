import { NextResponse } from "next/server";
import { findUserByCalendarToken } from "@/lib/calendar-feed";
import { getTaskByIdAny } from "@/lib/tasks";
import { sendPushToUser } from "@/lib/push";
import { sendFcmToUser } from "@/lib/fcm";

export const runtime = "nodejs";

/**
 * POST /api/geofences/transition?t=<token> — the geofence plugin calls this
 * (even while the app is suspended) when the device enters/exits a geofence.
 * We map the task and send the alert as a push. Token-authed (no session in bg).
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const user = await findUserByCalendarToken(token);
  if (!user) return NextResponse.json({ ok: true, ignored: "auth" });

  const body = (await req.json().catch(() => ({}))) as {
    identifier?: string;
    transition?: string;
    enter?: boolean;
    payload?: { title?: string; placeName?: string; trigger?: string };
  };
  const taskId = body.identifier;
  if (!taskId) return NextResponse.json({ ok: true, ignored: "no-identifier" });

  const task = await getTaskByIdAny(taskId);
  // Only notify for the token-holder's own, still-active task.
  if (!task || task.user_id !== user.id || task.status !== "active") {
    return NextResponse.json({ ok: true, ignored: "stale" });
  }

  const entering = body.transition === "enter" || body.enter === true;
  const place = body.payload?.placeName || "your place";
  const title = `📍 ${entering ? "Arriving at" : "Leaving"} ${place}`;
  const payload = {
    title,
    body: task.title,
    url: "/",
    taskId: task.id,
    doneStatus: task.category === "pay" ? "paid" : "done",
  };

  await sendPushToUser(user.id, payload).catch(() => 0);
  await sendFcmToUser(user.id, payload).catch(() => 0);

  return NextResponse.json({ ok: true });
}
