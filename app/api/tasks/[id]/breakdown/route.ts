import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleTask, updateTask } from "@/lib/tasks";
import { breakdownTask } from "@/lib/breakdown";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/tasks/:id/breakdown — AI-split a task into steps + time estimate. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await getAccessibleTask(user.id, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { steps, estimateMinutes } = await breakdownTask(task);
  if (steps.length === 0 && estimateMinutes == null) {
    return NextResponse.json({ error: "Couldn’t break that one down." }, { status: 422 });
  }

  // Append new steps to any existing checklist (preserve done states).
  const existing = task.checklist ?? [];
  const have = new Set(existing.map((c) => c.text.toLowerCase()));
  const merged = [
    ...existing,
    ...steps.filter((s) => !have.has(s.toLowerCase())).map((text) => ({ text, done: false })),
  ];

  const updated = await updateTask(user.id, id, {
    checklist: merged.length > 0 ? merged : null,
    estimate_minutes: estimateMinutes ?? task.estimate_minutes,
  });

  return NextResponse.json({ ok: true, steps, estimateMinutes, task: updated });
}
