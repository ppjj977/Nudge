import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembershipForUser, createInvite } from "@/lib/households";
import { sendEmail, esc, emailShell } from "@/lib/email";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** POST /api/family/invite { email } — email an invite to join the household. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const sent = await sendEmail({
    to: email,
    subject: `${inviter} invited you to “${family}” on nudge`,
    text: `${inviter} invited you to join their family "${family}" on nudge.\n\nAccept: ${link}\n\nThis invite expires in 7 days.`,
    html: emailShell({
      heading: `Join “${esc(family)}” on nudge`,
      intro: `${esc(inviter)} invited you to share tasks and reminders as a family. This invite expires in 7 days.`,
      ctaText: "Accept invite",
      ctaUrl: link,
    }),
  });

  return NextResponse.json({ ok: true, sent });
}
