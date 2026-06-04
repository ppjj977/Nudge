import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { updateTask, dismissTask } from "@/lib/tasks";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/tasks/:id — edit, mark done/paid, snooze, reschedule.
 * Reminder regeneration on due_at change is wired in phase 2 (SPEC §5, §10).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let patch: Record<string, unknown>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await getOrCreateDefaultUser();
  const task = await updateTask(user.id, id, patch);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

/** DELETE /api/tasks/:id — dismiss (soft-delete; cancels reminders in phase 2). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getOrCreateDefaultUser();
  const task = await dismissTask(user.id, id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}
