import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { confirmTask } from "@/lib/tasks";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/tasks/:id/confirm — promote a review-tray item to active (SPEC §10). */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = await confirmTask(user.id, id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}
