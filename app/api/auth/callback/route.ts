import { NextResponse } from "next/server";
import {
  consumeMagicToken,
  provisionUser,
  createSession,
  RegistrationClosedError,
} from "@/lib/auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** GET /api/auth/callback?token=... — consume a magic-link and start a session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "") || url.origin;

  const email = token ? await consumeMagicToken(token) : null;
  if (!email) {
    return NextResponse.redirect(`${base}/login?error=expired`, 303);
  }
  try {
    const user = await provisionUser(email);
    await createSession(user.id);
    return NextResponse.redirect(`${base}/`, 303);
  } catch (e) {
    if (e instanceof RegistrationClosedError) {
      return NextResponse.redirect(`${base}/register-interest?closed=1`, 303);
    }
    throw e;
  }
}
