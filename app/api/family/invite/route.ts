import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMembershipForUser, createInvite } from "@/lib/households";
import { sendEmail, esc } from "@/lib/email";
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
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2>Join “${esc(family)}” on nudge</h2><p>${esc(inviter)} invited you to share tasks and reminders as a family.</p><p><a href="${esc(link)}" style="display:inline-block;background:#7BAA94;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept invite</a></p><p style="color:#888;font-size:13px">This invite expires in 7 days. If you don't have a nudge account yet, create one with this email first, then open the link.</p></div>`,
  });

  return NextResponse.json({ ok: true, sent });
}
