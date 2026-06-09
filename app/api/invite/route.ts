import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { INVITE_COOKIE, inviteValid } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/invite?code=XYZ — the tester invite link. Validates the code and, if
 * good, drops a short-lived cookie that lets this browser create an account
 * while public sign-up is closed, then sends them to /signup. Bad/old codes
 * fall through to the public register-interest page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const base = config.appBaseUrl?.replace(/\/$/, "") || url.origin;

  if (!inviteValid(code)) {
    return NextResponse.redirect(`${base}/register-interest`);
  }
  const res = NextResponse.redirect(`${base}/signup`);
  res.cookies.set(INVITE_COOKIE, code!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60, // 14 days
  });
  return res;
}
