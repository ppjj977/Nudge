import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { getTimeline } from "@/lib/tasks";

export const runtime = "nodejs";

/** GET /api/tasks — timeline (today / week / later) + review tray (SPEC §10). */
export async function GET() {
  const user = await getOrCreateDefaultUser();
  const timeline = await getTimeline(user.id, user.timezone);
  return NextResponse.json(timeline);
}
