import { NextResponse } from "next/server";

/**
 * Tiny in-memory fixed-window rate limiter. Good enough for a single Render
 * instance: protects auth + email-sending endpoints from brute force and
 * email-bombing. Resets on restart and isn't shared across instances — fine
 * for this scale; swap for a store-backed limiter if we ever scale out.
 */
interface Window {
  count: number;
  resetAt: number;
}
const windows = new Map<string, Window>();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 NextResponse if `key` has exceeded `limit` hits within
 * `windowMs`, otherwise null (and counts the hit).
 */
export function rateLimited(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (w.count >= limit) {
    const retryAfter = Math.ceil((w.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many attempts. Please wait a bit and try again." },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }
  w.count += 1;
  return null;
}
