import { NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { sendEmail, esc } from "@/lib/email";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** POST /api/auth/request { email } — email a single-use magic-link. */
export async function POST(req: Request) {
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
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2>Sign in to nudge</h2><p><a href="${esc(link)}" style="display:inline-block;background:#22c1a2;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p><p style="color:#888;font-size:13px">This link expires in 15 minutes. If you didn't request it, ignore this email.</p></div>`,
  });

  // Always report success so we don't leak which emails exist.
  return NextResponse.json({ ok: true, sent });
}
