import { DateTime } from "luxon";
import { getOrCreateDefaultUser } from "@/lib/users";
import { getTimeline, type Task } from "@/lib/tasks";
import CaptureBox from "./CaptureBox";
import TaskCard, { type TaskView } from "./TaskCard";

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

function Section({
  title,
  tasks,
  review = false,
}: {
  title: string;
  tasks: Task[];
  review?: boolean;
}) {
  return (
    <section>
      <h2 className="section">{title}</h2>
      {tasks.length === 0 ? (
        <div className="empty">Nothing here.</div>
      ) : (
        tasks.map((t) => (
          <TaskCard key={t.id} task={toView(t)} review={review} />
        ))
      )}
    </section>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string }>;
}) {
  const user = await getOrCreateDefaultUser();
  const timeline = await getTimeline(user.id, user.timezone);
  const now = DateTime.now().setZone(user.timezone);
  const { shared } = await searchParams;
  const sharedMsg = shared ? SHARED_MESSAGES[shared] : null;

  return (
    <>
      <div className="greeting">
        <h1>{greeting(now.hour)}</h1>
        <p>Here’s your day.</p>
      </div>

      <CaptureBox />
      {sharedMsg && <div className="toast">{sharedMsg}</div>}

      <Section title="Today" tasks={timeline.today} />
      <Section title="This week" tasks={timeline.week} />
      <Section title="Later" tasks={timeline.later} />

      {timeline.review.length > 0 && (
        <>
          <div className="review-banner">
            {timeline.review.length} item
            {timeline.review.length === 1 ? "" : "s"} need a quick look — low
            confidence, so they are held out of your timeline.
          </div>
          <Section title="Needs review" tasks={timeline.review} review />
        </>
      )}
    </>
  );
}
