import { NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { sendEmail, emailShell } from "@/lib/email";
import { config } from "@/lib/config";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/auth/request { email } — email a single-use magic-link. */
export async function POST(req: Request) {
  const limited = rateLimited(`magic:${clientIp(req)}`, 5, 15 * 60_000);
  if (limited) return limited;
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = await createMagicToken(email);
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "");
  const link = `${base}/api/auth/callback?token=${token}`;

  const sent = await sendEmail({
    to: email,
    subject: "Your nudge sign-in link",
    text: `Sign in to nudge:\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: emailShell({
      heading: "Sign in to nudge",
      intro: "Tap the button to sign in. This link expires in 15 minutes.",
      ctaText: "Sign in",
      ctaUrl: link,
    }),
  });

  // Always report success so we don't leak which emails exist.
  return NextResponse.json({ ok: true, sent });
}
