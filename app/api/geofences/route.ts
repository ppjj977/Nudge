import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listGeofencesForUser } from "@/lib/geofences";

export const runtime = "nodejs";

/**
 * GET /api/geofences — the user's active arrival-reminder geofences, for the
 * native app to register once background geolocation is enabled (see
 * LOCATION.md). Returns [] until that's wired, so it's safe to ship now.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ geofences: await listGeofencesForUser(user.id) });
}
