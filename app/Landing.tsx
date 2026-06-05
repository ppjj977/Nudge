import Link from "next/link";
import LogoMark from "./LogoMark";

/** Public marketing page shown at "/" to logged-out visitors. */
export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <LogoMark size={56} />
        <h1>
          Capture anything.
          <br />
          Get nudged at the right time.
        </h1>
        <p className="hero-sub">
          nudge turns the chaos in your head — texts, photos, voice notes,
          forwarded emails — into a calm, organised timeline that reminds you
          before things slip.
        </p>
        <div className="hero-cta">
          <Link href="/signup" className="btn-primary-lg">
            Get started — it&apos;s free
          </Link>
          <Link href="/login" className="btn-ghost-lg">
            Sign in
          </Link>
        </div>
      </section>

      <section className="features">
        <h2 className="landing-h2">Everything in, sorted out</h2>
        <div className="feature-grid">
          <Feature
            title="Capture any way you like"
            body="Type it, snap a photo of a letter or whiteboard, record a voice note, or forward an email. nudge reads it all."
          />
          <Feature
            title="It figures out the task"
            body="Dates, times, amounts and what matters get pulled out automatically and dropped onto your timeline — no forms."
          />
          <Feature
            title="Nudges, not nagging"
            body="Gentle reminders at the right moment, plus a once-a-day digest so nothing important quietly slips away."
          />
          <Feature
            title="See money & dates clearly"
            body="Bills and payments roll up into a money view; everything with a date lands on a simple calendar."
          />
        </div>
      </section>

      <section className="who">
        <h2 className="landing-h2">Who it&apos;s for</h2>
        <ul className="who-list">
          <li>Busy people juggling work, home and life admin in one head.</li>
          <li>
            Anyone with ADHD or a memory like a sieve who needs a safety net,
            not another rigid to-do app.
          </li>
          <li>
            People drowning in screenshots, half-written notes and &ldquo;I&apos;ll
            remember that&rdquo; moments.
          </li>
        </ul>
      </section>

      <section className="why">
        <h2 className="landing-h2">Why people love it</h2>
        <div className="feature-grid">
          <Feature
            title="Zero friction"
            body="Capture in two seconds, however the thought arrives. The work of organising happens for you."
          />
          <Feature
            title="It catches the low-confidence stuff"
            body="Unsure items go to a review tray instead of being lost or guessed — you stay in control."
          />
          <Feature
            title="Private & yours"
            body="Your own account, your own data, your own forwarding address. No noisy feeds, no clutter."
          />
        </div>
      </section>

      <section className="landing-final">
        <h2 className="landing-h2">Ready to stop forgetting things?</h2>
        <div className="hero-cta">
          <Link href="/signup" className="btn-primary-lg">
            Create your account
          </Link>
          <Link href="/faq" className="btn-ghost-lg">
            Read the FAQs
          </Link>
        </div>
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
