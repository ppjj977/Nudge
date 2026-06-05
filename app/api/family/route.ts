import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createHousehold } from "@/lib/households";

export const runtime = "nodejs";

/** POST /api/family { name } — create a household (one per user). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const household = await createHousehold(
    user.id,
    typeof name === "string" ? name : "My family",
  );
  return NextResponse.json({ ok: true, household });
}
