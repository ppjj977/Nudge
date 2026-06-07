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
  /** Research (Pro): optional web-search grounding. With a Tavily key, the
   *  research brief cites real results; without it, the model gives a
   *  structured brief + suggested searches. */
  research: {
    tavilyKey: env("TAVILY_API_KEY"),
  },
  email: {
    resendApiKey: env("RESEND_API_KEY"),
    from: env("MAIL_FROM") ?? "nudge@example.com",
  },
  /** Public contact address shown in the privacy policy / terms. */
  supportEmail: env("SUPPORT_EMAIL") ?? "hello@nudgelive.co.uk",
  /** Email of the account allowed into /admin (subscriber stats, promo codes). */
  adminEmail: env("ADMIN_EMAIL")?.toLowerCase() ?? null,
  /** When false (default), public sign-up is closed — show register-interest. */
  registrationOpen: env("REGISTRATION_OPEN") === "true",
  /** Optional webhook (Slack/Discord/etc.) to alert on server errors. */
  errorWebhook: env("ERROR_WEBHOOK_URL"),
  /** RevenueCat: webhook auth header value + the entitlement that = Pro. */
  revenuecat: {
    webhookAuth: env("REVENUECAT_WEBHOOK_AUTH"),
    entitlement: env("REVENUECAT_ENTITLEMENT") ?? "pro",
  },
  /**
   * WhatsApp capture (Cloud API). Users forward messages/photos/voice notes to
   * the Nudge business number; the webhook runs them through the same pipeline.
   *  - verifyToken:  token you set in Meta's webhook config (GET challenge).
   *  - appSecret:    Meta app secret, used to verify X-Hub-Signature-256.
   *  - accessToken:  (system-user) token for the Graph API (send + media fetch).
   *  - phoneNumberId: the WABA phone-number id messages are sent from.
   *  - displayNumber: the human number in E.164 digits (e.g. 447700900123) for
   *    the wa.me deep-link shown in Settings.
   */
  whatsapp: {
    verifyToken: env("WHATSAPP_VERIFY_TOKEN"),
    appSecret: env("WHATSAPP_APP_SECRET"),
    accessToken: env("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
    displayNumber: env("WHATSAPP_DISPLAY_NUMBER"),
    graphVersion: env("WHATSAPP_GRAPH_VERSION") ?? "v21.0",
  },
  /** Email-in (SPEC §3): inbound capture via Resend's receiving webhook. */
  inbound: {
    /** Domain new per-user addresses are shown on, e.g. "in.nudgelive.co.uk". */
    domain: env("INBOUND_DOMAIN"),
    /** Resend (Svix) webhook signing secret, "whsec_…". */
    webhookSecret: env("INBOUND_WEBHOOK_SECRET"),
  },
  push: {
    publicKey: env("VAPID_PUBLIC_KEY"),
    privateKey: env("VAPID_PRIVATE_KEY"),
    subject: env("VAPID_SUBJECT") ?? "mailto:nudge@example.com",
  },
  /** Native push via FCM (Capacitor app). The full service-account JSON
   *  (raw or base64) from Firebase → Project settings → Service accounts. */
  fcm: {
    serviceAccount: env("FCM_SERVICE_ACCOUNT"),
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
