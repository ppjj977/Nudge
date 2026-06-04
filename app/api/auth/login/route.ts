import { NextResponse } from "next/server";
import {
  findUserByEmail,
  getPasswordHash,
  verifyPassword,
  createSession,
} from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/login { email, password } */
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const user = await findUserByEmail(email);
  const hash = user ? await getPasswordHash(user.id) : null;
  // Constant-ish failure message; don't reveal which part was wrong.
  if (!user || !hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
