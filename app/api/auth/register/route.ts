import { NextResponse } from "next/server";
import {
  findUserByEmail,
  provisionUser,
  setUserPassword,
  getPasswordHash,
  createSession,
} from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/register { email, password } */
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    const hash = await getPasswordHash(existing.id);
    if (hash) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 },
      );
    }
    // Account exists (e.g. via Google or the legacy seed) but has no password —
    // let the owner claim it by setting one.
    await setUserPassword(existing.id, password);
    await createSession(existing.id);
    return NextResponse.json({ ok: true });
  }

  const user = await provisionUser(email);
  await setUserPassword(user.id, password);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
