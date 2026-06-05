import Link from "next/link";

export const metadata = { title: "nudge — FAQs" };

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is nudge?",
    a: "nudge is a capture-first reminder app. You throw anything at it — a typed note, a photo, a voice memo, a forwarded email — and it works out what the task is, when it matters, and reminds you at the right time.",
  },
  {
    q: "How do I capture things?",
    a: "Type or paste into the capture box, snap a photo (of a letter, poster, or whiteboard), record a voice note, or forward/send an email to your personal nudge address. It all lands in the same place.",
  },
  {
    q: "What's the email-in address?",
    a: "Every account gets a private address like nudge-xxxx@nudgelive.co.uk (shown on your Profile page). Forward any email there and nudge turns it into tasks automatically.",
  },
  {
    q: "How does it decide what's a task?",
    a: "It reads your capture and pulls out the action, any dates, times and amounts, and a category. If it isn't confident, the item goes to a review tray instead of guessing — so nothing is lost and you stay in control.",
  },
  {
    q: "How do reminders work?",
    a: "You get gentle nudges ahead of time, plus a once-a-day digest of what's coming up. You can tune reminder timing and channels in Settings.",
  },
  {
    q: "Is my data private?",
    a: "Yes. You have your own account and your own data. nudge doesn't show you a public feed or share your captures.",
  },
  {
    q: "How much does it cost?",
    a: "Getting started is free. Create an account and start capturing.",
  },
  {
    q: "I forgot my password — what now?",
    a: "On the sign-in page, tap “Forgot your password? Email me a sign-in link”. We'll email a one-time link that signs you in; then you can set a new password from your Profile.",
  },
];

export default function FaqPage() {
  return (
    <div className="faq">
      <div className="settings-head">
        <Link href="/" className="back">
          ← Home
        </Link>
        <h1>Frequently asked questions</h1>
      </div>

      <div className="faq-list">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>

      <div className="landing-final">
        <Link href="/signup" className="btn-primary-lg">
          Get started
        </Link>
      </div>
    </div>
  );
}
