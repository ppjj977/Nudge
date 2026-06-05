import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLists, createList } from "@/lib/lists";

export const runtime = "nodejs";

/** GET /api/lists — all lists the user can see (own + shared family lists). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getLists(user.id));
}

/** POST /api/lists — create a list { name, kind?, shared? }. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const kind = typeof body.kind === "string" ? body.kind : "custom";
  const list = await createList(user.id, name, kind, Boolean(body.shared));
  return NextResponse.json(list, { status: 201 });
}
