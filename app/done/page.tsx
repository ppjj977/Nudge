import Link from "next/link";
import { getOrCreateDefaultUser, getUserLifeAreas } from "@/lib/users";
import { getCompletedTasks, type Task } from "@/lib/tasks";
import TaskCard, { type TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

export default async function DonePage() {
  const user = await getOrCreateDefaultUser();
  const tasks = await getCompletedTasks(user.id);
  const lifeAreas = getUserLifeAreas(user);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Closed Nudges</h1>
        <p className="note">
          Completed and paid tasks. Closed something by mistake? Hit Undo to send
          it back to your timeline.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">Nothing completed yet.</div>
      ) : (
        tasks.map((t: Task) => (
          <TaskCard
            key={t.id}
            task={t as unknown as TaskView}
            done
            lifeAreas={lifeAreas}
          />
        ))
      )}
    </>
  );
}
