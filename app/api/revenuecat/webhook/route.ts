import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { config } from "@/lib/config";
import { getUserById } from "@/lib/users";
import { setPlan } from "@/lib/plan";

export const runtime = "nodejs";

/**
 * RevenueCat webhook (https://www.revenuecat.com/docs/webhooks). RevenueCat is
 * the source of truth for paid entitlement; this keeps our `plan` column in
 * sync so the free cap lifts everywhere (app, web, cron). We set the RC
 * "app user id" to our user id at login, so event.app_user_id maps back here.
 *
 * Set the webhook URL to /api/revenuecat/webhook and the Authorization header
 * to REVENUECAT_WEBHOOK_AUTH in the RevenueCat dashboard.
 */
const ACTIVE = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "CANCELLATION", // auto-renew off, but still entitled until expiry
]);
const ENDED = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"]);

interface RcEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  expiration_at_ms?: number | null;
}

export async function POST(req: Request) {
  // Verify the shared Authorization header set in the RevenueCat dashboard.
  const expected = config.revenuecat.webhookAuth;
  if (expected) {
    const got = req.headers.get("authorization") ?? "";
    if (got !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  const event: RcEvent = body?.event ?? {};
  const type = event.type ?? "";
  if (type === "TEST") return NextResponse.json({ ok: true, test: true });

  // Resolve which of our users this is (we use user.id as the RC app user id).
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ].filter((s): s is string => typeof s === "string" && !s.startsWith("$RCAnonymous"));

  let userId: string | null = null;
  for (const c of candidates) {
    if (await getUserById(c)) {
      userId = c;
      break;
    }
  }
  if (!userId) {
    console.warn("[revenuecat] no matching user", { type, candidates });
    return NextResponse.json({ ok: true, ignored: "no-user" });
  }

  const expiresMs = event.expiration_at_ms ?? null;
  const expired = expiresMs != null && expiresMs < Date.now();

  if (ENDED.has(type) || expired) {
    await setPlan(userId, "free", null, "revenuecat");
  } else if (ACTIVE.has(type)) {
    const until = expiresMs ? DateTime.fromMillis(expiresMs).toUTC().toISO() : null;
    await setPlan(userId, "pro", until, "revenuecat");
  }
  // Other event types (BILLING_ISSUE, TRANSFER, etc.) — no plan change here.

  console.log("[revenuecat] processed", { type, userId, expiresMs });
  return NextResponse.json({ ok: true });
}
