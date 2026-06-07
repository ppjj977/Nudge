import { NextResponse } from "next/server";
import { getActiveTasks } from "@/lib/tasks";
import { buildIcsFeed, findUserByCalendarToken } from "@/lib/calendar-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/<token>.ics — public, token-authenticated iCalendar feed of
 * the user's dated tasks. Subscribe to it from Google/Apple/Outlook calendars.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const token = file.replace(/\.ics$/i, "");
  const user = await findUserByCalendarToken(token);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const tasks = await getActiveTasks(user.id);
  const ics = buildIcsFeed(user, tasks);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="nudge.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}
