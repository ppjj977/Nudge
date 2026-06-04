import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getPasswordHash,
  verifyPassword,
  setUserPassword,
  updateUserName,
  updateUserEmail,
  emailTaken,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/profile
 * { name?, email?, currentPassword?, newPassword? }
 * Updates any subset of the signed-in user's profile.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  // --- name ---
  if (typeof body.name === "string") {
    await updateUserName(user.id, body.name.trim() || null);
  }

  // --- email ---
  if (typeof body.email === "string") {
    const email = body.email.toLowerCase().trim();
    if (!email.includes("@") || email.length < 3) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    if (email !== user.email) {
      if (await emailTaken(email, user.id)) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 },
        );
      }
      await updateUserEmail(user.id, email);
    }
  }

  // --- password ---
  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    const existing = await getPasswordHash(user.id);
    if (existing) {
      // Must prove ownership before changing an existing password.
      if (!body.currentPassword || !verifyPassword(body.currentPassword, existing)) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 403 },
        );
      }
    }
    await setUserPassword(user.id, body.newPassword);
  }

  return NextResponse.json({ ok: true });
}
