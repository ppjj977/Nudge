import Link from "next/link";
import LogoMark from "./LogoMark";
import DemoPlayer from "./DemoPlayer";

/** Public marketing page shown at "/" to logged-out visitors. */
export default function Landing() {
  return (
    <div className="landing">
      {/* ---- hero ---- */}
      <section className="hero">
        <LogoMark size={52} />
        <h1>a gentle nudge for everything that matters</h1>
        <p className="hero-sub">
          Send Nudge the messy stuff. It pulls out what matters and reminds you
          before it slips.
        </p>
        <div className="hero-cta">
          <Link href="/register-interest" className="btn-primary-lg">
            Register your interest
          </Link>
        </div>
        <a href="#how" className="hero-link">
          See how it works ↓
        </a>

        <DemoPlayer />
      </section>

      {/* ---- screenshots ---- */}
      <section className="shots">
        <h2 className="landing-h2">See it in action</h2>
        <div className="shots-row">
          {SHOTS.map((s) => (
            <figure className="shot" key={s.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.cap} loading="lazy" />
              <figcaption className="shot-cap">{s.cap}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---- how it works ---- */}
      <section id="how" className="how">
        <h2 className="landing-h2">How it works</h2>
        <div className="how-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <div className="step-num">{s.n}</div>
              <div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- before / after ---- */}
      <section className="demo">
        <h2 className="landing-h2">Messy in, sorted out</h2>
        <div className="example-list">
          {EXAMPLES.map((ex) => (
            <div className="example-card" key={ex.from}>
              <div className="example-from">{ex.from}</div>
              <div className="example-arrow">becomes</div>
              <div className="example-tasks">
                {ex.tasks.map((t) => (
                  <span className="task-pill" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- trust ---- */}
      <section className="trust">
        <h2 className="landing-h2">Built to be trusted</h2>
        <ul className="trust-list">
          {TRUST.map((t) => (
            <li className="trust-item" key={t}>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- audience ---- */}
      <section className="who">
        <h2 className="landing-h2">{"Who it's for"}</h2>
        <div className="feature-grid">
          {AUDIENCE.map((a) => (
            <div className="feature-card" key={a.t}>
              <h3>{a.t}</h3>
              <p>{a.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- final CTA ---- */}
      <section className="landing-final">
        <h2 className="landing-h2">Give Nudge one messy thing. See what it catches.</h2>
        <div className="hero-cta">
          <Link href="/register-interest" className="btn-primary-lg">
            Register your interest
          </Link>
          <Link href="/faq" className="btn-ghost-lg">
            Read the FAQs
          </Link>
        </div>
      </section>

      {/* ---- footer: Play Store coming soon ---- */}
      <footer className="landing-foot">
        <span className="foot-soon">📱 Coming soon to Google Play</span>
        <span>
          ·{" "}
          <Link href="/register-interest" className="foot-apk">
            Register your interest
          </Link>{" "}
          to be first in
        </span>
      </footer>
    </div>
  );
}

const SHOTS = [
  { src: "/screenshots/timeline.png", cap: "Your timeline" },
  { src: "/screenshots/calendar.png", cap: "Multi-day plans on the calendar" },
  { src: "/screenshots/family-tab.png", cap: "Share with your family" },
];

const STEPS = [
  {
    n: 1,
    t: "Capture anything",
    d: "Type it, snap it, speak it, or forward an email. However the thought arrives.",
  },
  {
    n: 2,
    t: "Nudge extracts the tasks",
    d: "It reads the mess and pulls out the action, dates, times and amounts.",
  },
  {
    n: 3,
    t: "You review anything uncertain",
    d: "Low-confidence guesses wait in a review tray — never lost, never assumed.",
  },
  {
    n: 4,
    t: "Get reminded at the right time",
    d: "Gentle nudges before things slip, plus a once-a-day digest.",
  },
];

const EXAMPLES = [
  {
    from: "School newsletter",
    tasks: ["Bring PE kit — Friday", "Pay £15 trip — by 15 June"],
  },
  {
    from: "Screenshot of an appointment",
    tasks: ["Attend dentist — Tuesday 9:30"],
  },
  {
    from: "Photo of a bill",
    tasks: ["Pay water bill £42.18 — by 28 June"],
  },
];

const TRUST = [
  "Raw captures are temporary.",
  "Low-confidence guesses go to review.",
  "You stay in control.",
  "No noisy feeds. No social layer. No productivity theatre.",
];

const AUDIENCE = [
  { t: "Parents", d: "Juggling school admin, letters and trip payments." },
  {
    t: "Life-admin jugglers",
    d: "Managing bills, appointments and renewals in one head.",
  },
  {
    t: "ADHD & forgetful",
    d: "Anyone who needs a safety net, not another rigid to-do app.",
  },
  {
    t: "Screenshot hoarders",
    d: "Anyone who screenshots things and then forgets them.",
  },
];
