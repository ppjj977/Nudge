import { config } from "./config";

/**
 * Report a server-side error: always to the logs, and (if ERROR_WEBHOOK_URL is
 * set) to a Slack/Discord-style webhook so failures surface without watching
 * logs. Never throws — logging must not break the request.
 */
export async function reportError(context: string, err: unknown): Promise<void> {
  const detail =
    err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error(`[error] ${context}: ${detail}`);

  if (!config.errorWebhook) return;
  const text = `⚠️ nudge error — ${context}\n${detail.slice(0, 1500)}`;
  try {
    await fetch(config.errorWebhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `text` (Slack) and `content` (Discord) so either works.
      body: JSON.stringify({ text, content: text }),
    });
  } catch {
    /* swallow — never throw from the logger */
  }
}
