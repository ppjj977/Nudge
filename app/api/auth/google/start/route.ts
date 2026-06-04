import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { googleAuthUrl } from "@/lib/oauth-google";
import { googleEnabled } from "@/lib/auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** GET /api/auth/google/start — kick off the Google OAuth flow. */
export async function GET(req: Request) {
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "") || new URL(req.url).origin;
  if (!googleEnabled()) {
    return NextResponse.redirect(`${base}/login?error=google_unconfigured`, 303);
  }
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("nudge_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state), 303);
}
