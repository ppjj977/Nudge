import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { grantProByEmail } from "@/lib/plan";

export const runtime = "nodejs";

/** POST /api/admin/grant { email, durationDays } — comp a user to Pro. Admin only. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const durationDays =
    typeof body.durationDays === "number" && body.durationDays > 0
      ? Math.trunc(body.durationDays)
      : null;
  const ok = await grantProByEmail(email, durationDays);
  if (!ok) return NextResponse.json({ error: "No user with that email." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
