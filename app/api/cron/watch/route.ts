import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { runWatchChecks } from "@/lib/watch";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST/GET /api/cron/watch — re-check active "watch → notify" conditions and
 * fire a push when one is met. Secured by CRON_SECRET. Schedule it on
 * cron-job.org every ~15–30 min (lighter than the reminder dispatch tick).
 */
async function handle(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const result = await runWatchChecks();
  return NextResponse.json(result);
}

export const POST = handle;
export const GET = handle;
