"use client";

import { useState } from "react";
import TaskCard, { type TaskView } from "./TaskCard";

type Tab = "today" | "week" | "later" | "money" | "review";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "money", label: "Money" },
  { key: "review", label: "Needs review" },
];

const EMPTY: Record<Tab, string> = {
  today: "Nothing for today. Breathe.",
  week: "Nothing booked this week.",
  later: "Nothing parked for later.",
  money: "No payments to track right now.",
  review: "Nothing to review — you’re all caught up.",
};

export default function Timeline({
  today,
  week,
  later,
  review,
  lifeAreas,
}: {
  today: TaskView[];
  week: TaskView[];
  later: TaskView[];
  review: TaskView[];
  lifeAreas: string[];
}) {
  const money = [...today, ...week, ...later].filter((t) => t.category === "pay");
  const lists: Record<Tab, TaskView[]> = { today, week, later, money, review };
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, lists[t.key].length]),
  ) as Record<Tab, number>;

  // Review is the hero: open straight to it when there's anything uncertain.
  const [tab, setTab] = useState<Tab>(review.length > 0 ? "review" : "today");
  const active = lists[tab];

  return (
    <div className="timeline">
      {review.length > 0 && tab !== "review" && (
        <button className="review-banner" onClick={() => setTab("review")}>
          <span className="nudge-dot" /> {review.length}{" "}
          {review.length === 1 ? "thing needs" : "things need"} a quick look →
        </button>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
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

      {active.length === 0 ? (
        <div className="empty">{EMPTY[tab]}</div>
      ) : (
        active.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            review={tab === "review"}
            lifeAreas={lifeAreas}
          />
        ))
      )}
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
