import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { seedDemoAccount } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * POST /api/admin/demo { email?, password? } — create/refresh the Play-review
 * demo account (comped to Pro, sample tasks seeded). Admin only. Returns the
 * credentials to paste into Play Console → App access.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email : undefined;
  const password =
    typeof body.password === "string" && body.password.length >= 6 ? body.password : undefined;

  const result = await seedDemoAccount({ email, password });
  return NextResponse.json({ ok: true, ...result });
}
