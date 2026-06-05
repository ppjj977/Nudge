import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleTask, setSnoozedUntil } from "@/lib/tasks";
import { snoozeTask } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * POST /api/tasks/[id]/snooze { date: "YYYY-MM-DD", time?: "HH:MM" }
 * Schedules a one-off nudge at the chosen local time.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, time } = await req.json().catch(() => ({}));
  if (typeof date !== "string" || !date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }
  const local = DateTime.fromISO(`${date}T${time || "09:00"}`, {
    zone: user.timezone,
  });
  if (!local.isValid) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (local <= DateTime.now()) {
    return NextResponse.json(
      { error: "Pick a time in the future" },
      { status: 400 },
    );
  }

  const task = await getAccessibleTask(user.id, id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fireUtc = local.toUTC().toISO()!;
  await snoozeTask(task, fireUtc);
  await setSnoozedUntil(user.id, id, fireUtc);
  return NextResponse.json({ ok: true, fire_at: local.toISO() });
}
