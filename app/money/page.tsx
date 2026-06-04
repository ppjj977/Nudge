import { DateTime } from "luxon";
import Link from "next/link";
import { getOrCreateDefaultUser, getUserLifeAreas } from "@/lib/users";
import { getActiveTasks, bucketFor, type Task } from "@/lib/tasks";
import TaskCard, { type TaskView } from "../TaskCard";

export const dynamic = "force-dynamic";

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Sum amounts grouped by currency, formatted as "£x · $y". */
function totalLabel(tasks: Task[]): string {
  const byCcy = new Map<string, number>();
  for (const t of tasks) {
    if (t.amount == null) continue;
    const ccy = t.currency || "GBP";
    byCcy.set(ccy, (byCcy.get(ccy) ?? 0) + t.amount);
  }
  if (byCcy.size === 0) return "—";
  return [...byCcy.entries()].map(([c, v]) => fmt(v, c)).join(" · ");
}

export default async function MoneyPage() {
  const user = await getOrCreateDefaultUser();
  const lifeAreas = getUserLifeAreas(user);
  const now = DateTime.now().setZone(user.timezone);

  const active = await getActiveTasks(user.id);
  const money = active.filter((t) => t.category === "pay" || t.category === "renew");
  const dueThisWeek = money.filter((t) => {
    const b = bucketFor(t, now);
    return b === "today" || b === "week";
  });

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Money</h1>
        <p className="note">Everything with money attached — what’s going out, and when.</p>
      </div>

      <div className="money-summary">
        <div className="money-stat">
          <span className="money-figure">{totalLabel(money)}</span>
          <span className="note">total outstanding</span>
        </div>
        <div className="money-stat">
          <span className="money-figure">{totalLabel(dueThisWeek)}</span>
          <span className="note">due this week</span>
        </div>
      </div>

      {money.length === 0 ? (
        <div className="empty">No payments or renewals on your plate. 🎉</div>
      ) : (
        money.map((t) => (
          <TaskCard key={t.id} task={t as unknown as TaskView} lifeAreas={lifeAreas} />
        ))
      )}
    </>
  );
}
