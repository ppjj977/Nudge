import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listWatches } from "@/lib/watch";
import { isPro } from "@/lib/plan";
import WatchManager from "../WatchManager";

export const dynamic = "force-dynamic";

export default async function WatchPage() {
  const user = await requireUser();
  const watches = await listWatches(user.id);

  return (
    <div className="container">
      <div className="settings-head">
        <Link href="/" className="back">← Timeline</Link>
        <h1>Watches</h1>
        <p className="note">
          Watch a web page and get nudged the moment a condition comes true — a price
          drop, back in stock, a date released. Checked automatically through the day.
        </p>
      </div>
      <WatchManager
        initial={watches.map((w) => ({
          id: w.id,
          url: w.url,
          condition: w.condition,
          label: w.label,
          status: w.status,
          last_checked: w.last_checked,
          last_note: w.last_note,
        }))}
        pro={isPro(user)}
      />
    </div>
  );
}
