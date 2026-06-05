import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { redeemCode } from "@/lib/plan";

export const runtime = "nodejs";

/** POST /api/plan/redeem { code } — redeem a promo code for Pro. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const result = await redeemCode(user.id, code);
  return NextResponse.json({ result }, { status: result === "ok" ? 200 : 400 });
}
