import { NextResponse } from "next/server";
import { joinWaitlist, FREE_FOR_LIFE_COHORT } from "@/lib/interest";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

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
  return NextResponse.json({
    ok: true,
    already: !result.ok, // true when this email was already on the list
    position,
    freeForLife,
    cohort: FREE_FOR_LIFE_COHORT,
  });
}
