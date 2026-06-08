import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { getUserLifeAreas } from "@/lib/users";
import { getRecentlyCreated } from "@/lib/tasks";
import { getRecentEmptyCaptures } from "@/lib/captures";
import TaskCard, { type TaskView } from "../TaskCard";
import RecentCaptures from "../RecentCaptures";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  email: "📨 from email",
  image: "📷 from a photo",
  audio: "🎤 from a voice note",
  text: "✍️ typed in",
  whatsapp: "💬 from WhatsApp",
};

function ago(iso: string, zone: string): string {
  const then = DateTime.fromISO(iso, { zone });
  if (!then.isValid) return "";
  const mins = Math.round(DateTime.now().diff(then, "minutes").minutes);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return then.toFormat("ccc d LLL");
}

/** Recently added — confirms captures (especially forwarded emails) landed. */
export default async function RecentPage() {
  const user = await requireUser();
  const lifeAreas = getUserLifeAreas(user);
  const recent = await getRecentlyCreated(user.id);
  const empties = await getRecentEmptyCaptures(user.id);

  return (
    <div className="container">
      <div className="settings-head">
        <Link href="/" className="back">← Timeline</Link>
        <h1>Recently added</h1>
        <p className="note">
          Everything Nudge has captured lately — so you can confirm a forwarded
          email, photo or voice note actually landed.
        </p>
      </div>

      <RecentCaptures
        items={empties.map((c) => ({
          id: c.id,
          source: c.source,
          status: c.status,
          subject: c.subject,
          snippet: c.snippet,
          label: `${SOURCE_LABEL[c.source] ?? "✍️ added"} · ${ago(c.received_at, user.timezone)}`,
        }))}
      />

      {recent.length === 0 && empties.length === 0 ? (
        <div className="empty">Nothing captured yet.</div>
      ) : (
        recent.map((t) => (
          <div className="recent-item" key={t.id}>
            <div className="recent-meta">
              <span>{SOURCE_LABEL[t.capture_source ?? ""] ?? "✍️ added"}</span>
              <span>· {ago(t.created_at, user.timezone)}</span>
            </div>
            <TaskCard
              task={t as unknown as TaskView}
              review={t.status === "review"}
              done={t.status === "done" || t.status === "paid"}
              lifeAreas={lifeAreas}
            />
          </div>
        ))
      )}
    </div>
  );
}
