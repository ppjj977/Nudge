import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleTask, setTaskResearch } from "@/lib/tasks";
import { researchTask } from "@/lib/research";
import { isPro } from "@/lib/plan";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/tasks/:id/research — AI research brief for a to-do (Pro only). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPro(user)) {
    return NextResponse.json(
      { error: "Research is a Nudge Pro feature.", upgrade: true },
      { status: 402 },
    );
  }

  const task = await getAccessibleTask(user.id, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await researchTask(task);
  await setTaskResearch(user.id, id, JSON.stringify(result));
  return NextResponse.json({ ok: true, research: result });
}
