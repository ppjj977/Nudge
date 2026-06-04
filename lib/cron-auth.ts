import { config } from "./config";

/**
 * Guard for the cron endpoints. Accepts the shared secret via the
 * `x-cron-secret` header, an `Authorization: Bearer <secret>` header, or a
 * `?secret=` query param. Returns an error response when unauthorized.
 */
export function checkCronAuth(req: Request): Response | null {
  const secret = config.cron.secret;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");

  if (provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
