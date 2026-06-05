import { createSign } from "node:crypto";
import { db, ensureSchema } from "./db";
import { newId } from "./ids";
import { config } from "./config";

/**
 * Native push via Firebase Cloud Messaging (HTTP v1). Used by the Capacitor
 * Android app for first-class, app-branded notifications. Auth uses the
 * service-account JSON (FCM_SERVICE_ACCOUNT) to mint an OAuth token — no
 * firebase-admin dependency; we sign the JWT with Node crypto.
 */
interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = config.fcm.serviceAccount;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as Partial<ServiceAccount>;
    if (sa.client_email && sa.private_key && sa.project_id) {
      return sa as ServiceAccount;
    }
  } catch {
    /* malformed */
  }
  return null;
}

export function fcmEnabled(): boolean {
  return serviceAccount() !== null;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.error(`[fcm] token exchange ${res.status}`, await res.text().catch(() => ""));
    return null;
  }
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/* -------------------------------------------------------------------------- */
/* Token storage                                                               */
/* -------------------------------------------------------------------------- */

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO fcm_tokens (id, user_id, token, created_at) VALUES (?,?,?,?)
          ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id`,
    args: [newId("fcm"), userId, token, new Date().toISOString()],
  });
}

async function userTokens(userId: string): Promise<string[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT token FROM fcm_tokens WHERE user_id = ?",
    args: [userId],
  });
  return (res.rows as unknown as { token: string }[]).map((r) => r.token);
}

async function deleteToken(token: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM fcm_tokens WHERE token = ?", args: [token] });
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send to all of a user's native devices. Prunes dead tokens. */
export async function sendFcmToUser(
  userId: string,
  payload: FcmPayload,
): Promise<number> {
  const sa = serviceAccount();
  if (!sa) return 0;
  const access = await getAccessToken(sa);
  if (!access) return 0;

  const tokens = await userTokens(userId);
  let delivered = 0;
  for (const token of tokens) {
    const message: Record<string, unknown> = {
      token,
      notification: { title: payload.title, body: payload.body },
    };
    if (payload.url) message.data = { url: payload.url };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${access}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message }),
      },
    );
    if (res.ok) {
      delivered++;
    } else {
      const text = await res.text().catch(() => "");
      // Prune tokens the FCM service reports as gone/invalid.
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(text)) {
        await deleteToken(token);
      }
      console.error(`[fcm] send ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return delivered;
}
