/**
 * Centralised env / config access. Per SPEC §3 and §13 nothing here is
 * hardcoded that Adam might want to tune at build time — notably GROQ_MODEL,
 * the confidence threshold, and retention days.
 */

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function num(name: string, fallback: number): number {
  const v = env(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  db: {
    url: env("TURSO_DATABASE_URL") ?? "file:./relay.db",
    authToken: env("TURSO_AUTH_TOKEN"),
  },
  groq: {
    apiKey: env("GROQ_API_KEY"),
    /** Text extraction model. Set from Groq's catalogue at build time. */
    model: env("GROQ_MODEL"),
    /** Optional vision model for image-to-text; falls back to Tesseract OCR. */
    visionModel: env("GROQ_VISION_MODEL"),
    /** Speech-to-text model for voice notes. */
    whisperModel: env("GROQ_WHISPER_MODEL") ?? "whisper-large-v3",
  },
  extraction: {
    /** Items below this land in the review tray (SPEC §7 rule 2). */
    confidenceThreshold: num("CONFIDENCE_THRESHOLD", 0.6),
  },
  retention: {
    rawRetentionDays: num("RAW_RETENTION_DAYS", 30),
  },
  email: {
    resendApiKey: env("RESEND_API_KEY"),
    from: env("MAIL_FROM") ?? "nudge@example.com",
  },
  push: {
    publicKey: env("VAPID_PUBLIC_KEY"),
    privateKey: env("VAPID_PRIVATE_KEY"),
    subject: env("VAPID_SUBJECT") ?? "mailto:nudge@example.com",
  },
  cron: {
    secret: env("CRON_SECRET"),
  },
  google: {
    clientId: env("GOOGLE_CLIENT_ID"),
    clientSecret: env("GOOGLE_CLIENT_SECRET"),
  },
  appBaseUrl: env("APP_BASE_URL"),
  /**
   * Phase 1 convenience. Magic-link auth (SPEC §10a) is a later phase; until
   * then the app runs as a single seeded user so extraction can be proven.
   */
  defaultUser: {
    email: env("DEFAULT_USER_EMAIL") ?? "adam@example.com",
    timezone: env("DEFAULT_USER_TIMEZONE") ?? "Europe/London",
  },
} as const;

export function requireGroq(): { apiKey: string; model: string } {
  if (!config.groq.apiKey) {
    throw new Error("GROQ_API_KEY is not set. See .env.example.");
  }
  if (!config.groq.model) {
    throw new Error(
      "GROQ_MODEL is not set. Pick a current model from Groq's catalogue (SPEC §13).",
    );
  }
  return { apiKey: config.groq.apiKey, model: config.groq.model };
}
