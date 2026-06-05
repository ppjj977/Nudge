import { NextResponse } from "next/server";
import { reportError } from "@/lib/log";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/log { context, message } — client error boundary reports here. */
export async function POST(req: Request) {
  const limited = rateLimited(`log:${clientIp(req)}`, 20, 60_000);
  if (limited) return limited;
  const { context, message } = await req.json().catch(() => ({}));
  await reportError(
    typeof context === "string" ? `client:${context}` : "client",
    typeof message === "string" ? message.slice(0, 2000) : "(no message)",
  );
  return NextResponse.json({ ok: true });
}
