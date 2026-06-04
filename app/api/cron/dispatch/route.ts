import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { runDispatch } from "@/lib/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/cron/dispatch — fire due reminders (SPEC §4). Driven every ~15 min
 * by the GitHub Actions schedule (.github/workflows/cron.yml). Secured by
 * CRON_SECRET. GET is allowed too so simple pingers work.
 */
async function handle(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const result = await runDispatch();
  return NextResponse.json(result);
}

export const POST = handle;
export const GET = handle;
