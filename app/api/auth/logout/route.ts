import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/logout */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
