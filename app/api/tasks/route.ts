import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTimeline, createManualTask } from "@/lib/tasks";

export const runtime = "nodejs";

/** GET /api/tasks — timeline (today / week / later) + review tray (SPEC §10). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const timeline = await getTimeline(user.id, user.timezone);
  return NextResponse.json(timeline);
}

/** POST /api/tasks — create a task by hand (manual entry fallback). */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = await createManualTask(user.id, {
    title,
    category: typeof body.category === "string" ? body.category : undefined,
    detail: typeof body.detail === "string" ? body.detail : null,
    due_at: typeof body.due_at === "string" ? body.due_at : null,
    due_type: body.due_type as never,
    end_at: typeof body.end_at === "string" ? body.end_at : null,
    amount: typeof body.amount === "number" ? body.amount : null,
    currency: typeof body.currency === "string" ? body.currency : null,
    location: typeof body.location === "string" ? body.location : null,
    life_area: typeof body.life_area === "string" ? body.life_area : null,
    recurrence: body.recurrence ?? null,
  });
  return NextResponse.json(task, { status: 201 });
}
