import { NextResponse } from "next/server";
import {
  findUserByEmail,
  provisionUser,
  setUserPassword,
  getPasswordHash,
  updateUserName,
  createSession,
  signupAllowed,
} from "@/lib/auth";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/auth/register { name?, email, password } */
export async function POST(req: Request) {
  if (!(await signupAllowed())) {
    return NextResponse.json(
      { error: "Sign-ups aren’t open yet — register your interest.", closed: true },
      { status: 403 },
    );
  }
  const limited = rateLimited(`register:${clientIp(req)}`, 5, 15 * 60_000);
  if (limited) return limited;
  const { name, email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const cleanName = typeof name === "string" && name.trim() ? name.trim() : null;
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
    if (cleanName && !existing.name) await updateUserName(existing.id, cleanName);
    await createSession(existing.id);
    return NextResponse.json({ ok: true });
  }

  const user = await provisionUser(email, { name: cleanName }, { allowSignup: true });
  await setUserPassword(user.id, password);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
