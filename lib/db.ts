import { createClient, type Client } from "@libsql/client";
import { config } from "./config";

/**
 * libSQL client (SPEC §3). A module-level singleton so the Next dev server's
 * hot-reload does not open a new connection on every request.
 */
declare global {
  // eslint-disable-next-line no-var
  var __relayDb: Client | undefined;
}

export const db: Client =
  globalThis.__relayDb ??
  createClient({
    url: config.db.url,
    authToken: config.db.authToken,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__relayDb = db;
}
