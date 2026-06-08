import { NextResponse } from "next/server";
import { joinWaitlist, FREE_FOR_LIFE_COHORT } from "@/lib/interest";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { sendEmail, emailShell, esc } from "@/lib/email";

export const runtime = "nodejs";

/** Notify the team when a genuinely new person joins the waitlist. */
async function alertNewSignup(input: {
  email: string;
  name?: string | null;
  note?: string | null;
  position: number;
  freeForLife: boolean;
}): Promise<void> {
  const to = config.adminEmail ?? config.supportEmail;
  if (!to) return;
  const bits = [
    `<b>${esc(input.email)}</b>`,
    input.name ? esc(input.name) : null,
    `#${input.position}${input.freeForLife ? " · 🎁 free for life" : ""}`,
    input.note ? `“${esc(input.note)}”` : null,
  ].filter(Boolean);
  try {
    await sendEmail({
      to,
      replyTo: input.email,
      subject: `New nudge waitlist sign-up — #${input.position}`,
      text: `New waitlist sign-up: ${input.email} (#${input.position})${input.note ? `\nNote: ${input.note}` : ""}`,
      html: emailShell({
        heading: "New waitlist sign-up",
        bodyHtml: `<p style="color:#232A32;font-size:15px">${bits.join(" · ")}</p>`,
      }),
    });
  } catch (e) {
    console.error("[interest] alert email failed", e);
  }
}

/** POST /api/interest { email, name?, note?, source? } — join the waitlist. */
export async function POST(req: Request) {
  const limited = rateLimited(`interest:${clientIp(req)}`, 10, 15 * 60_000);
  if (limited) return limited;

  const { email, name, note, source } = await req.json().catch(() => ({}));
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const result = await joinWaitlist({
    email,
    name: typeof name === "string" ? name : null,
    note: typeof note === "string" ? note : null,
    source: typeof source === "string" ? source : null,
  });

  if (!result.ok && result.reason === "invalid") {
    return NextResponse.json({ error: "That doesn’t look like a valid email." }, { status: 400 });
  }

  const { position, freeForLife } = result as { position: number; freeForLife: boolean };

  // Only alert on a genuinely new sign-up (not a repeat of an existing email).
  if (result.ok) {
    await alertNewSignup({
      email: email.toLowerCase().trim(),
      name: typeof name === "string" ? name : null,
      note: typeof note === "string" ? note : null,
      position,
      freeForLife,
    });
  }

  return NextResponse.json({
    ok: true,
    already: !result.ok, // true when this email was already on the list
    position,
    freeForLife,
    cohort: FREE_FOR_LIFE_COHORT,
  });
}
