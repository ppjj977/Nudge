import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode, fetchGoogleProfile } from "@/lib/oauth-google";
import { provisionUser, createSession, signupAllowed, RegistrationClosedError } from "@/lib/auth";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** GET /api/auth/google/callback?code=&state= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "") || url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expected = jar.get("nudge_oauth_state")?.value;
  jar.delete("nudge_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${base}/login?error=oauth`, 303);
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const profile = await fetchGoogleProfile(accessToken);
    const user = await provisionUser(
      profile.email,
      { name: profile.name, image: profile.picture },
      { allowSignup: await signupAllowed() },
    );
    await createSession(user.id);
    return NextResponse.redirect(`${base}/`, 303);
  } catch (e) {
    if (e instanceof RegistrationClosedError) {
      return NextResponse.redirect(`${base}/register-interest?closed=1`, 303);
    }
    return NextResponse.redirect(`${base}/login?error=oauth`, 303);
  }
}
