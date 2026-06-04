import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { runDigest } from "@/lib/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/cron/digest — send the daily digest to any user whose local time
 * has reached their digest hour (SPEC §9). Run hourly. Secured by CRON_SECRET.
 */
async function handle(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const result = await runDigest();
  return NextResponse.json(result);
}

export const POST = handle;
export const GET = handle;
