import Link from "next/link";

export const metadata = { title: "Categories & help — nudge" };

interface CatInfo {
  icon: string;
  name: string;
  what: string;
  reminders: string;
}

const CATEGORIES: CatInfo[] = [
  {
    icon: "💷",
    name: "pay",
    what: "Money out by a date. The only category that tracks an amount; completing it reads as “Paid”.",
    reminders: "3 days before, 1 day before, and on the due date",
  },
  {
    icon: "📅",
    name: "book",
    what: "Arrange a slot or appointment. The due date is your deadline to book by — not the event itself.",
    reminders: "1 week before, then 2 days before",
  },
  {
    icon: "📍",
    name: "attend",
    what: "Be somewhere at a set time. Wants a date + time and a location.",
    reminders: "1 day before, and the morning of",
  },
  {
    icon: "🎒",
    name: "prepare",
    what: "Have something ready or bring something on a day. Grouped events hang their bring-list here as a checklist.",
    reminders: "the evening before (6pm) and the morning of (7am)",
  },
  {
    icon: "✉️",
    name: "send",
    what: "Deliver or reply to someone by a date — an email, a form, a document.",
    reminders: "1 day before, and on the due date",
  },
  {
    icon: "🔁",
    name: "renew",
    what: "A recurring deadline before something lapses or auto-charges, so you can cancel or shop around in time.",
    reminders: "2 weeks before, then 3 days before",
  },
  {
    icon: "🧳",
    name: "trip",
    what: "A holiday, trip away or multi-day time off. Set a start and end date to block the whole period on the calendar.",
    reminders: "1 week before, and the day before (6pm)",
  },
  {
    icon: "🎂",
    name: "celebrate",
    what: "A birthday, anniversary or yearly occasion to remember. Usually set to repeat every year.",
    reminders: "1 week before (time to sort a card or gift), and on the day",
  },
  {
    icon: "⏰",
    name: "reminder",
    what: "A catch-all time-based nudge with no cleaner verb above.",
    reminders: "on the due date",
  },
  {
    icon: "📄",
    name: "fyi",
    what: "Informational — asks nothing of you. Shown muted; used sparingly so real tasks aren’t invented.",
    reminders: "none",
  },
];

export default function HelpPage() {
  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Categories &amp; tags</h1>
        <p className="note">
          nudge sorts everything by <strong>action type</strong> — what you’d
          actually do. The category decides the reminder schedule (all editable
          in Settings).
        </p>
      </div>

      <section className="panel">
        <h2>Action categories</h2>
        {CATEGORIES.map((c) => (
          <div key={c.name} className="guide-item">
            <span className="guide-icon" aria-hidden="true">
              {c.icon}
            </span>
            <div>
              <span className="chip cat">{c.name}</span>
              <div className="meta" style={{ marginTop: 4 }}>
                {c.what}
              </div>
              <div className="note">Reminders: {c.reminders}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>The two tags on a card</h2>
        <p>
          <span className="chip cat">category</span> — what kind of action it is
          (above). This drives the reminders.
        </p>
        <p>
          <span className="chip">life area</span> — which part of life it belongs
          to (school, home, work…). A secondary label only; it doesn’t affect
          reminders, and you can customise the list in Settings.
        </p>
        <p className="note">
          The italic quote on a card is the <strong>source excerpt</strong> — the
          snippet from what you captured that justifies the task, so you can see
          why it exists.
        </p>
      </section>

      <section className="panel">
        <h2>Timeline sections</h2>
        <p>
          <strong>Today</strong> — due today, plus anything overdue.
        </p>
        <p>
          <strong>This week</strong> — due between tomorrow and this Sunday.
        </p>
        <p>
          <strong>Later</strong> — next week onward, and anything with no date.
        </p>
        <p>
          <strong>Needs review</strong> — low-confidence extractions, held back
          until you confirm them.
        </p>
        <p>
          <strong>Closed Nudges</strong> (in the menu) — completed/paid tasks,
          with Undo.
        </p>
      </section>
    </>
  );
}
