import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTask, setTaskHousehold } from "@/lib/tasks";
import { getMembershipForUser } from "@/lib/households";
import { generateRemindersForTask } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * POST /api/tasks/[id]/share { share: boolean }
 * Shares the task with the user's household (or makes it private again) and
 * reconciles reminders so the whole family is nudged for shared tasks.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { share } = await req.json().catch(() => ({}));
  const task = await getTask(user.id, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let householdId: string | null = null;
  if (share) {
    const membership = await getMembershipForUser(user.id);
    if (!membership) {
      return NextResponse.json(
        { error: "Create or join a family first." },
        { status: 400 },
      );
    }
    householdId = membership.household.id;
  }

  const updated = await setTaskHousehold(user.id, id, householdId);
  if (updated) await generateRemindersForTask(updated);
  return NextResponse.json({ ok: true, shared: Boolean(householdId) });
}
