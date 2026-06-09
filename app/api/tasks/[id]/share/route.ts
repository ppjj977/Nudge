import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTask, setTaskHousehold } from "@/lib/tasks";
import { getMembershipForUser, memberIds } from "@/lib/households";
import { generateRemindersForTask } from "@/lib/reminders";
import { sendPushToUser } from "@/lib/push";
import { sendFcmToUser } from "@/lib/fcm";

export const runtime = "nodejs";

/** Tell the rest of the family (not the sharer) that a task was just shared. */
async function notifyFamilyOfShare(
  householdId: string,
  sharerId: string,
  sharerName: string | null,
  taskId: string,
  taskTitle: string,
): Promise<void> {
  const who = sharerName?.split(" ")[0]?.trim() || "Someone";
  const payload = {
    title: `${who} shared a task with the family`,
    body: taskTitle,
    url: `/?task=${taskId}`, // opens + focuses the task on tap
  };
  const others = (await memberIds(householdId)).filter((id) => id !== sharerId);
  for (const uid of others) {
    await sendPushToUser(uid, payload).catch(() => 0);
    await sendFcmToUser(uid, payload).catch(() => 0);
  }
}

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

  const wasShared = Boolean(task.household_id);
  const updated = await setTaskHousehold(user.id, id, householdId);
  if (updated) await generateRemindersForTask(updated);
  // Notify the family only when newly shared (not on re-share or un-share).
  if (householdId && !wasShared) {
    await notifyFamilyOfShare(householdId, user.id, user.name, id, task.title);
  }
  return NextResponse.json({ ok: true, shared: Boolean(householdId) });
}
