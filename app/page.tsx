import { DateTime } from "luxon";
import { getUserLifeAreas, ensureInboundAddress } from "@/lib/users";
import { getCurrentUser } from "@/lib/auth";
import { getMembershipForUser } from "@/lib/households";
import { getTimeline, getFamilyTasks, type Task } from "@/lib/tasks";
import CaptureBox from "./CaptureBox";
import ManualAdd from "./ManualAdd";
import Timeline from "./Timeline";
import { type TaskView } from "./TaskCard";
import Landing from "./Landing";

// Always read fresh state; the dashboard reflects live captures.
export const dynamic = "force-dynamic";

function toView(t: Task): TaskView {
  return t as unknown as TaskView;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const SHARED_MESSAGES: Record<string, string> = {
  added: "Added to your timeline.",
  nothing: "Nothing actionable in that — so nothing was added.",
  failed: "Couldn’t read that one. Try again or paste the text.",
  empty: "Nothing to capture there.",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string }>;
}) {
  // Logged-out visitors get the public marketing page; signed-in users get
  // their timeline at the same URL.
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const timeline = await getTimeline(user.id, user.timezone);
  const lifeAreas = getUserLifeAreas(user);
  const inboundAddress = await ensureInboundAddress(user);
  const membership = await getMembershipForUser(user.id);
  const family = membership ? await getFamilyTasks(membership.household.id) : [];
  const now = DateTime.now().setZone(user.timezone);
  const { shared } = await searchParams;
  const sharedMsg = shared ? SHARED_MESSAGES[shared] : null;

  return (
    <>
      <div className="greeting">
        <h1>
          {greeting(now.hour)}
          {user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p>Here’s your day.</p>
      </div>

      <CaptureBox inboundAddress={inboundAddress} />
      {sharedMsg && <div className="toast">{sharedMsg}</div>}
      <ManualAdd />

      <Timeline
        today={timeline.today.map(toView)}
        week={timeline.week.map(toView)}
        later={timeline.later.map(toView)}
        review={timeline.review.map(toView)}
        family={family}
        inHousehold={Boolean(membership)}
        meId={user.id}
        lifeAreas={lifeAreas}
      />
    </>
  );
}
