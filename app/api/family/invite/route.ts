import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembershipForUser, createInvite } from "@/lib/households";
import { sendEmail, esc, emailShell, emailBrand } from "@/lib/email";
import { config } from "@/lib/config";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/family/invite { email } — email an invite to join the household. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimited(`invite:${clientIp(req)}`, 10, 60 * 60_000);
  if (limited) return limited;

  const membership = await getMembershipForUser(user.id);
  if (!membership) {
    return NextResponse.json(
      { error: "Create your family first." },
      { status: 400 },
    );
  }

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const token = await createInvite(membership.household.id, email, user.id);
  const base = (config.appBaseUrl ?? "").replace(/\/$/, "");
  const link = `${base}/family/join?token=${token}`;
  const inviter = user.name || user.email;
  const family = membership.household.name;

  const bodyHtml = `
    <p style="color:${emailBrand.text};margin:0 0 14px;line-height:1.5">
      nudge turns the messy stuff — texts, photos, voice notes, forwarded emails
      — into a calm, shared to-do list and reminds your whole family at the right
      time.
    </p>
    <p style="color:${emailBrand.muted};margin:0 0 6px;font-weight:700;font-size:13px">As a family you can:</p>
    <ul style="color:${emailBrand.text};margin:0 0 16px;padding-left:18px;line-height:1.7">
      <li>Share things like bills, appointments and school admin</li>
      <li>Get nudged together — nothing slips between you</li>
      <li>Keep your own private tasks too</li>
    </ul>
    <p style="color:${emailBrand.muted};font-size:13px;margin:0;line-height:1.5">
      New to nudge? Create an account with <strong>${esc(email)}</strong> first,
      then open this link. The invite expires in 7 days.
    </p>`;

  const text = [
    `${inviter} invited you to join their family "${family}" on nudge.`,
    "",
    "nudge turns texts, photos, voice notes and forwarded emails into a calm shared to-do list, and reminds your whole family at the right time.",
    "",
    "As a family you can:",
    "• Share bills, appointments and school admin",
    "• Get nudged together — nothing slips between you",
    "• Keep your own private tasks too",
    "",
    `Accept your invite: ${link}`,
    "",
    `New to nudge? Create an account with ${email} first, then open the link. This invite expires in 7 days.`,
  ].join("\n");

  const sent = await sendEmail({
    to: email,
    subject: `${inviter} invited you to “${family}” on nudge`,
    text,
    html: emailShell({
      heading: `Join “${esc(family)}” on nudge`,
      intro: `${esc(inviter)} invited you to share tasks and reminders as a family.`,
      bodyHtml,
      ctaText: "Accept invite",
      ctaUrl: link,
    }),
  });

  return NextResponse.json({ ok: true, sent });
}
