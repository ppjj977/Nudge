"use client";

import { useEffect, useState } from "react";

/**
 * Mandatory one-time, hands-on tour. New users perform each core gesture on a
 * safe sample task — capture, then edit / snooze / complete — so they learn by
 * doing rather than reading. Remembered in localStorage; shows once.
 */
const EXAMPLE = "Dentist Tuesday at 3pm";

const COPY: Record<number, { title: string; body: string }> = {
  1: {
    title: "Your first reminder ✨",
    body: "Nudge read your note, pulled out the date, and made a task. That's the whole idea — send the mess, get a reminder. Tap Next.",
  },
  2: {
    title: "Plans change — edit it",
    body: "Tap Edit to change the title, time or details of any task.",
  },
  3: {
    title: "Not now? Snooze it",
    body: "Tap Snooze to be reminded another time instead.",
  },
  4: {
    title: "Sorted? Tick it off",
    body: "When it's done, tap Done and it leaves your list.",
  },
};

export default function Tutorial() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0); // 0 capture · 1 created · 2 edit · 3 snooze · 4 done · 5 finish
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("Dentist");
  const [snoozed, setSnoozed] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("nudge_tutorial_done")) setActive(true);
    } catch {
      /* storage blocked — skip the tour */
    }
  }, []);

  if (!active) return null;

  function finish() {
    try {
      localStorage.setItem("nudge_tutorial_done", "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  }

  const copy = COPY[step];

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true">
      <div className="tut-card">
        <div className="tut-dots" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`tut-dot ${i <= step ? "on" : ""}`} />
          ))}
        </div>

        {/* Step 0 — capture */}
        {step === 0 && (
          <>
            <h2>Welcome to Nudge 👋</h2>
            <p>
              Nudge turns a quick note into a reminder. Let&apos;s try it — tap the
              example below, then Capture.
            </p>
            <div className="tut-capture">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a task…"
              />
              <button type="button" className="example-chip" onClick={() => setText(EXAMPLE)}>
                {EXAMPLE}
              </button>
            </div>
            <button
              className="primary tut-next"
              disabled={!text.trim()}
              onClick={() => setStep(1)}
            >
              Capture →
            </button>
          </>
        )}

        {/* Steps 1–4 — the sample task */}
        {step >= 1 && step <= 4 && copy && (
          <>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>

            <div className={`task tut-task ${completed ? "is-done" : ""}`}>
              <div className="body">
                <div>
                  <span className="task-emoji" aria-hidden="true">📅</span>
                  {editing ? (
                    <input
                      className="tut-edit-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className="title">{title}</span>
                  )}
                </div>
                <div className="chips">
                  <span className="chip cat">attend</span>
                  <span className="chip">Tue 3pm</span>
                </div>
                {snoozed && <div className="meta">💤 Snoozed till tomorrow</div>}
              </div>

              <div className="actions">
                {editing ? (
                  <button
                    className="primary pulse"
                    onClick={() => {
                      setEditing(false);
                      setStep(3);
                    }}
                  >
                    Save
                  </button>
                ) : (
                  <>
                    <button
                      className={step === 4 ? "pulse" : ""}
                      disabled={step !== 4}
                      onClick={() => {
                        setCompleted(true);
                        setStep(5);
                      }}
                    >
                      Done
                    </button>
                    <button
                      className={step === 3 ? "pulse" : ""}
                      disabled={step !== 3}
                      onClick={() => {
                        setSnoozed(true);
                        setStep(4);
                      }}
                    >
                      Snooze
                    </button>
                    <button
                      className={step === 2 ? "pulse" : ""}
                      disabled={step !== 2}
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {step === 1 && (
              <button className="primary tut-next" onClick={() => setStep(2)}>
                Next →
              </button>
            )}
          </>
        )}

        {/* Step 5 — finish */}
        {step === 5 && (
          <>
            <h2>🎉 That&apos;s it — you&apos;re ready</h2>
            <p>
              Capture anything (type it, snap a photo, or speak it), and edit, snooze
              or tick things off just like that. Your real timeline is waiting.
            </p>
            <button className="primary tut-next" onClick={finish}>
              Start using Nudge
            </button>
          </>
        )}
      </div>
    </div>
  );
}
