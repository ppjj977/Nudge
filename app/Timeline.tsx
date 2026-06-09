"use client";

import { useEffect, useState } from "react";
import TaskCard, { type TaskView } from "./TaskCard";
import type { FamilyTask } from "@/lib/tasks";
import type { Member } from "@/lib/households";

type Tab = "today" | "week" | "later" | "unscheduled" | "family" | "review";

const EMPTY: Record<Tab, string> = {
  today: "Nothing for today. Breathe.",
  week: "Nothing booked this week.",
  later: "Nothing parked for later.",
  unscheduled: "No loose to-dos — everything has a home.",
  family: "Nothing shared with the family yet.",
  review: "Nothing to review — you’re all caught up.",
};

export default function Timeline({
  today,
  week,
  later,
  unscheduled,
  review,
  family,
  members,
  lifeAreas,
  inHousehold,
  meId,
}: {
  today: TaskView[];
  week: TaskView[];
  later: TaskView[];
  unscheduled: TaskView[];
  review: TaskView[];
  family: FamilyTask[];
  members: Member[];
  lifeAreas: string[];
  inHousehold: boolean;
  meId: string;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "later", label: "Later" },
    { key: "unscheduled", label: "To-dos" },
    ...(inHousehold ? [{ key: "family" as Tab, label: "Family" }] : []),
    // The review tab only appears when something actually needs a look.
    ...(review.length > 0 ? [{ key: "review" as Tab, label: "Needs review" }] : []),
  ];
  const counts: Record<Tab, number> = {
    today: today.length,
    week: week.length,
    later: later.length,
    unscheduled: unscheduled.length,
    family: family.length,
    review: review.length,
  };

  const [tab, setTab] = useState<Tab>(review.length > 0 ? "review" : "today");
  const [focusId, setFocusId] = useState<string | null>(null);

  /** Which tab holds a given task id (shared tasks live in Family). */
  function tabFor(id: string): Tab | null {
    if (family.some((t) => t.id === id)) return "family";
    if (today.some((t) => t.id === id)) return "today";
    if (week.some((t) => t.id === id)) return "week";
    if (later.some((t) => t.id === id)) return "later";
    if (unscheduled.some((t) => t.id === id)) return "unscheduled";
    if (review.some((t) => t.id === id)) return "review";
    return null;
  }

  // Deep link from a notification: /?task=<id> → open its tab.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("task");
    if (!id) return;
    const tb = tabFor(id);
    if (tb) setTab(tb);
    setFocusId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // …then scroll to it and flash it once the right tab is rendered.
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`t-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("task-flash");
    const t = setTimeout(() => el.classList.remove("task-flash"), 2200);
    return () => clearTimeout(t);
  }, [focusId, tab]);

  type OwnedTab = "today" | "week" | "later" | "unscheduled";
  const owned: Record<OwnedTab, TaskView[]> = {
    today,
    week,
    later,
    unscheduled,
  };

  return (
    <div className="timeline">
      {review.length > 0 && tab !== "review" && (
        <button className="review-banner" onClick={() => setTab("review")}>
          <span className="nudge-dot" /> {review.length}{" "}
          {review.length === 1 ? "thing needs" : "things need"} a quick look →
        </button>
      )}

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? "active" : ""} ${
              t.key === "review" ? "review-tab" : ""
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === "review" && review.length > 0 && (
        <p className="review-hero">
          Nudge wasn’t sure about these. Approve, edit, or dismiss.
        </p>
      )}
      {tab === "family" && (
        <p className="note family-note">
          Shared with your family — anyone can tick these off, and everyone gets
          the nudge. Use “Assigned to” to say who’s on it.
        </p>
      )}

      {tab === "family" &&
        (family.length === 0 ? (
          <div className="empty">{EMPTY.family}</div>
        ) : (
          family.map((t) => (
            <div id={`t-${t.id}`} key={t.id}>
              <TaskCard
                task={t as unknown as TaskView}
                ownerName={t.user_id === meId ? "you" : t.owner_name || t.owner_email}
                members={members}
                assignable
                lifeAreas={lifeAreas}
              />
            </div>
          ))
        ))}

      {tab === "review" &&
        (review.length === 0 ? (
          <div className="empty">{EMPTY.review}</div>
        ) : (
          review.map((t) => (
            <div id={`t-${t.id}`} key={t.id}>
              <TaskCard task={t} review lifeAreas={lifeAreas} />
            </div>
          ))
        ))}

      {tab === "unscheduled" && unscheduled.length > 0 && (
        <p className="note">To-dos with no date attached — do them whenever.</p>
      )}

      {tab !== "family" &&
        tab !== "review" &&
        (owned[tab as OwnedTab].length === 0 ? (
          <div className="empty">{EMPTY[tab]}</div>
        ) : (
          owned[tab as OwnedTab].map((t) => (
            <div id={`t-${t.id}`} key={t.id}>
              <TaskCard task={t} inHousehold={inHousehold} lifeAreas={lifeAreas} />
            </div>
          ))
        ))}
    </div>
  );
}
