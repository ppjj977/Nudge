import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unlinkWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

/** DELETE /api/whatsapp/link — disconnect the user's WhatsApp number. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await unlinkWhatsApp(user.id);
  return NextResponse.json({ ok: true });
}
