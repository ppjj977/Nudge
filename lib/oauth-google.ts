import { config } from "./config";

/** Minimal Google OAuth 2.0 (authorization code) helper. */

export function googleRedirectUri(): string {
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.google.clientId ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId ?? "",
      client_secret: config.google.clientSecret ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token from Google");
  return json.access_token;
}

export interface GoogleProfile {
  email: string;
  name: string | null;
  picture: string | null;
  verified: boolean;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  const u = (await res.json()) as {
    email?: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
  };
  if (!u.email) throw new Error("Google profile had no email");
  return {
    email: u.email,
    name: u.name ?? null,
    picture: u.picture ?? null,
    verified: u.verified_email ?? true,
  };
}
