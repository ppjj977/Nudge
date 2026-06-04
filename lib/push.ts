import webpush from "web-push";
import { db } from "./db";
import { newId } from "./ids";
import { config } from "./config";

/**
 * Web push (app notifications). VAPID keys come from env; generate once with
 * `npx web-push generate-vapid-keys`. If keys are unset, sending no-ops.
 */
let configured = false;
function ensureConfigured(): boolean {
  if (!config.push.publicKey || !config.push.privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      config.push.subject,
      config.push.publicKey,
      config.push.privateKey,
    );
    configured = true;
  }
  return true;
}

export function pushEnabled(): boolean {
  return Boolean(config.push.publicKey && config.push.privateKey);
}

export interface StoredSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  // Upsert on endpoint so re-subscribing the same device doesn't duplicate.
  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth`,
    args: [
      newId("sub"),
      userId,
      sub.endpoint,
      sub.keys.p256dh,
      sub.keys.auth,
      new Date().toISOString(),
    ],
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
    args: [endpoint],
  });
}

export async function getUserSubscriptions(
  userId: string,
): Promise<StoredSubscription[]> {
  const res = await db.execute({
    sql: "SELECT * FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  return res.rows as unknown as StoredSubscription[];
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push to all of a user's devices. Prunes subscriptions the push
 * service reports as gone (404/410). Returns the count actually delivered.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await getUserSubscriptions(userId);
  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      delivered++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await deleteSubscription(s.endpoint);
      } else {
        console.error(`[push] send failed (${code ?? "?"}):`, err);
      }
    }
  }
  return delivered;
}
