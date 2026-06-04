import Link from "next/link";
import { getOrCreateDefaultUser, getUserLifeAreas } from "@/lib/users";
import { getActiveTasks } from "@/lib/tasks";
import FilterView from "../FilterView";
import type { TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

export default async function FilterPage() {
  const user = await getOrCreateDefaultUser();
  const tasks = await getActiveTasks(user.id);
  const lifeAreas = getUserLifeAreas(user);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Filter</h1>
        <p className="note">Narrow your tasks by category and life area.</p>
      </div>
      <FilterView tasks={tasks as unknown as TaskView[]} lifeAreas={lifeAreas} />
    </>
  );
}
