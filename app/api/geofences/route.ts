import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listGeofencesForUser } from "@/lib/geofences";
import { ensureCalendarToken } from "@/lib/calendar-feed";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * GET /api/geofences — the user's active arrival/leave rules for the native app
 * to register, plus the URL the geofence plugin should POST transitions to
 * (so alerts fire even while the app is suspended). Token-authed like the
 * calendar feed, since the background POST carries no session cookie.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await ensureCalendarToken(user);
  const base = (config.appBaseUrl ?? new URL(req.url).origin).replace(/\/$/, "");

  return NextResponse.json({
    geofences: await listGeofencesForUser(user.id),
    transitionUrl: `${base}/api/geofences/transition?t=${token}`,
  });
}
