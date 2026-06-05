"use client";

import { useEffect, useState } from "react";

/**
 * Self-running landing-page demo: a messy capture on the left, and on the right
 * nudge "reads" it and reveals clean, dated tasks one by one — then loops.
 * Decorative but illustrative; pauses, replays, and respects reduced-motion.
 */
const TASKS = [
  { icon: "🎒", title: "Bring PE kit", when: "Fri" },
  { icon: "💷", title: "Pay £15 trip", when: "by 15 Jun" },
  { icon: "📅", title: "Parents’ evening — book", when: "soon" },
];

// Step machine: 0 messy shown · 1 reading · 2-4 reveal tasks · 5 hold · loop.
const LAST = 5;

export default function DemoPlayer() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(LAST); // show the finished state, no animation
      return;
    }
    const delay = step === 0 ? 1400 : step === 1 ? 1100 : step === LAST ? 2600 : 850;
    const t = setTimeout(() => setStep((s) => (s >= LAST ? 0 : s + 1)), delay);
    return () => clearTimeout(t);
  }, [step]);

  const revealed = Math.max(0, step - 1); // how many task cards are showing
  const reading = step === 1;

  return (
    <div className="demo-player" aria-label="Demo: a school newsletter becomes dated tasks">
      <div className="dp-panel dp-in">
        <div className="dp-label">messy in</div>
        <div className="dp-note">
          Fwd: Oakwood newsletter — PE kits needed <b>Friday</b>, museum trip{" "}
          <b>£15 due 15 June</b>, parents’ evening booking now open…
        </div>
        <div className="dp-chips">
          <span>✉️ email</span>
          <span>📷 photo</span>
          <span>🎤 voice</span>
        </div>
      </div>

      <div className={`dp-arrow ${reading ? "is-reading" : ""}`}>
        {reading ? "✨" : "→"}
      </div>

      <div className="dp-panel dp-out">
        <div className="dp-label">sorted out</div>
        {TASKS.map((t, i) => (
          <div
            key={t.title}
            className={`dp-task ${i < revealed ? "show" : ""}`}
          >
            <span className="dp-task-icon">{t.icon}</span>
            <span className="dp-task-title">{t.title}</span>
            <b>{t.when}</b>
          </div>
        ))}
        {revealed === 0 && !reading && (
          <div className="dp-task-placeholder">waiting for a capture…</div>
        )}
      </div>
    </div>
  );
}
