import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { sendEmail, emailShell, esc } from "@/lib/email";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/feedback { message } — emails app feedback to the support inbox. */
export async function POST(req: Request) {
  const limited = rateLimited(`feedback:${clientIp(req)}`, 5, 15 * 60_000);
  if (limited) return limited;

  const user = await getCurrentUser();
  const { message } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || message.trim().length < 3) {
    return NextResponse.json({ error: "Please add a little more detail." }, { status: 400 });
  }
  const trimmed = message.trim().slice(0, 4000);
  const fromUser = user?.email ?? "anonymous";

  const ok = await sendEmail({
    to: config.supportEmail,
    replyTo: user?.email,
    subject: `nudge feedback from ${fromUser}`,
    text: `From: ${fromUser}\n\n${trimmed}`,
    html: emailShell({
      heading: "New app feedback",
      intro: `From ${esc(fromUser)}`,
      bodyHtml: `<p style="white-space:pre-wrap;color:#232A32;font-size:15px;line-height:1.5">${esc(trimmed)}</p>`,
    }),
  });

  if (!ok) {
    return NextResponse.json({ error: "Couldn’t send right now — please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
