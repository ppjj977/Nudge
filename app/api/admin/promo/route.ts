import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { createPromoCode } from "@/lib/plan";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    return null;
  }
  return user;
}

/** POST /api/admin/promo — create a promo code. Admin only. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  const durationDays =
    typeof body.durationDays === "number" && body.durationDays > 0
      ? Math.trunc(body.durationDays)
      : null;
  const maxRedemptions =
    typeof body.maxRedemptions === "number" && body.maxRedemptions > 0
      ? Math.trunc(body.maxRedemptions)
      : null;
  try {
    await createPromoCode({
      code,
      durationDays,
      maxRedemptions,
      note: typeof body.note === "string" ? body.note : null,
    });
  } catch {
    return NextResponse.json({ error: "That code already exists." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
