"use client";

import { useState } from "react";
import TaskCard, { type TaskView } from "./TaskCard";
import { CATEGORIES } from "@/lib/categories";

export default function FilterView({
  tasks,
  lifeAreas,
}: {
  tasks: TaskView[];
  lifeAreas: string[];
}) {
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const filtered = tasks.filter(
    (t) =>
      (cats.size === 0 || cats.has(t.category)) &&
      (areas.size === 0 || (t.life_area != null && areas.has(t.life_area))),
  );

  const clear = () => {
    setCats(new Set());
    setAreas(new Set());
  };
  const anyFilter = cats.size > 0 || areas.size > 0;

  return (
    <>
      <div className="filter-group">
        <div className="filter-label">Category</div>
        <div className="pills">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`pill ${cats.has(c) ? "on" : ""}`}
              onClick={() => toggle(cats, c, setCats)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {lifeAreas.length > 0 && (
        <div className="filter-group">
          <div className="filter-label">Life area</div>
          <div className="pills">
            {lifeAreas.map((a) => (
              <button
                key={a}
                className={`pill area ${areas.has(a) ? "on" : ""}`}
                onClick={() => toggle(areas, a, setAreas)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-count">
        {filtered.length} of {tasks.length} task{tasks.length === 1 ? "" : "s"}
        {anyFilter && (
          <button className="link" onClick={clear}>
            clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No tasks match these filters.</div>
      ) : (
        filtered.map((t) => (
          <TaskCard key={t.id} task={t} lifeAreas={lifeAreas} />
        ))
      )}
    </>
  );
}
