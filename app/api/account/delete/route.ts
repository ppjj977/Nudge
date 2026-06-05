import { NextResponse } from "next/server";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/account";

export const runtime = "nodejs";

/** POST /api/account/delete — permanently delete the signed-in user + data. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteUserAccount(user.id);
  await destroySession();
  return NextResponse.json({ ok: true });
}
