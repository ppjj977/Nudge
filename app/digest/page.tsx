import { DateTime } from "luxon";
import Link from "next/link";
import { getOrCreateDefaultUser, getUserLifeAreas } from "@/lib/users";
import { getTimeline, type Task } from "@/lib/tasks";
import TaskCard, { type TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DigestSection({
  title,
  tasks,
  lifeAreas,
}: {
  title: string;
  tasks: Task[];
  lifeAreas: string[];
}) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className="section">{title}</h2>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t as unknown as TaskView} lifeAreas={lifeAreas} />
      ))}
    </section>
  );
}

export default async function DigestPage() {
  const user = await getOrCreateDefaultUser();
  const timeline = await getTimeline(user.id, user.timezone);
  const lifeAreas = getUserLifeAreas(user);
  const now = DateTime.now().setZone(user.timezone);

  const empty =
    timeline.today.length === 0 &&
    timeline.week.length === 0 &&
    timeline.review.length === 0;

  return (
    <>
      <div className="greeting">
        <h1>{greeting(now.hour)}</h1>
        <p>{now.toFormat("cccc d LLLL")} — your digest.</p>
      </div>

      {empty ? (
        <div className="caught-up">
          <div className="caught-up-emoji">✨</div>
          <strong>You’re all caught up.</strong>
          <p className="note">Nothing due today or this week. Enjoy the calm.</p>
        </div>
      ) : (
        <>
          <DigestSection title="Today" tasks={timeline.today} lifeAreas={lifeAreas} />
          <DigestSection
            title="This week"
            tasks={timeline.week}
            lifeAreas={lifeAreas}
          />
          {timeline.review.length > 0 && (
            <div className="review-banner">
              {timeline.review.length} item
              {timeline.review.length === 1 ? "" : "s"} waiting in{" "}
              <Link href="/">your review tray</Link>.
            </div>
          )}
        </>
      )}

      <p className="note" style={{ marginTop: 22 }}>
        This is the same summary nudge emails you each morning. Manage everything
        on your <Link href="/">timeline</Link>.
      </p>
    </>
  );
}
