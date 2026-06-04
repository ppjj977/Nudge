import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** GET /api/push/vapid — the public VAPID key the client subscribes with. */
export async function GET() {
  return NextResponse.json({ publicKey: config.push.publicKey ?? null });
}
