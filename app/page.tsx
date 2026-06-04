import { getOrCreateDefaultUser } from "@/lib/users";
import { getTimeline, type Task } from "@/lib/tasks";
import CaptureBox from "./CaptureBox";
import TaskCard, { type TaskView } from "./TaskCard";

// Always read fresh state; the dashboard reflects live captures.
export const dynamic = "force-dynamic";

function toView(t: Task): TaskView {
  return t as unknown as TaskView;
}

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
      <h2>{title}</h2>
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

export default async function Dashboard() {
  const user = await getOrCreateDefaultUser();
  const timeline = await getTimeline(user.id, user.timezone);

  return (
    <>
      <CaptureBox />

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
