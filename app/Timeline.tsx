"use client";

import { useState } from "react";
import TaskCard, { type TaskView } from "./TaskCard";
import type { FamilyTask } from "@/lib/tasks";

type Tab = "today" | "week" | "later" | "family" | "money" | "review";

const EMPTY: Record<Tab, string> = {
  today: "Nothing for today. Breathe.",
  week: "Nothing booked this week.",
  later: "Nothing parked for later.",
  family: "Nothing shared with the family yet.",
  money: "No payments to track right now.",
  review: "Nothing to review — you’re all caught up.",
};

export default function Timeline({
  today,
  week,
  later,
  review,
  family,
  lifeAreas,
  inHousehold,
  meId,
}: {
  today: TaskView[];
  week: TaskView[];
  later: TaskView[];
  review: TaskView[];
  family: FamilyTask[];
  lifeAreas: string[];
  inHousehold: boolean;
  meId: string;
}) {
  const money = [...today, ...week, ...later].filter((t) => t.category === "pay");

  const tabs: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "later", label: "Later" },
    ...(inHousehold ? [{ key: "family" as Tab, label: "Family" }] : []),
    { key: "money", label: "Money" },
    { key: "review", label: "Needs review" },
  ];
  const counts: Record<Tab, number> = {
    today: today.length,
    week: week.length,
    later: later.length,
    family: family.length,
    money: money.length,
    review: review.length,
  };

  const [tab, setTab] = useState<Tab>(review.length > 0 ? "review" : "today");

  const owned: Record<"today" | "week" | "later" | "money", TaskView[]> = {
    today,
    week,
    later,
    money,
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
      {tab === "money" && money.length > 0 && (
        <p className="money-total">{moneyTotal(money)}</p>
      )}
      {tab === "family" && (
        <p className="note family-note">
          Shared with your family — everyone gets the nudge. Manage your own from
          the other tabs.
        </p>
      )}

      {tab === "family" &&
        (family.length === 0 ? (
          <div className="empty">{EMPTY.family}</div>
        ) : (
          family.map((t) => (
            <TaskCard
              key={t.id}
              task={t as unknown as TaskView}
              readOnly
              ownerName={t.user_id === meId ? "you" : t.owner_name || t.owner_email}
              lifeAreas={lifeAreas}
            />
          ))
        ))}

      {tab === "review" &&
        (review.length === 0 ? (
          <div className="empty">{EMPTY.review}</div>
        ) : (
          review.map((t) => (
            <TaskCard key={t.id} task={t} review lifeAreas={lifeAreas} />
          ))
        ))}

      {tab !== "family" &&
        tab !== "review" &&
        (owned[tab as "today" | "week" | "later" | "money"].length === 0 ? (
          <div className="empty">{EMPTY[tab]}</div>
        ) : (
          owned[tab as "today" | "week" | "later" | "money"].map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              inHousehold={inHousehold}
              lifeAreas={lifeAreas}
            />
          ))
        ))}
    </div>
  );
}

function moneyTotal(tasks: TaskView[]): string {
  const sum = tasks.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const currency = tasks.find((t) => t.currency)?.currency || "GBP";
  let label: string;
  try {
    label = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      sum,
    );
  } catch {
    label = `${currency} ${sum.toFixed(2)}`;
  }
  return `${label} across ${tasks.length} ${tasks.length === 1 ? "payment" : "payments"}`;
}
