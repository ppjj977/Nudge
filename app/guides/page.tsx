import Link from "next/link";

export const metadata = { title: "How-to guides — nudge" };

interface Guide {
  slug: string;
  title: string;
  blurb: string;
  steps: string[];
}

const GUIDES: Guide[] = [
  {
    slug: "forward-email",
    title: "Forward an email",
    blurb:
      "Send any confirmation, invite or school newsletter to your private nudge address and it becomes a dated task — no typing it out again.",
    steps: [
      "Find your email-in address in Settings → Email-in.",
      "Forward (or BCC) any email to it.",
      "nudge reads the what, when & where and adds it to your timeline.",
    ],
  },
  {
    slug: "create-task",
    title: "Create a task by typing",
    blurb:
      "No forms or date-pickers — just type it like you'd say it. nudge pulls out the date, time and amount for you.",
    steps: [
      "Type into the capture box on the timeline (e.g. “pay water bill friday £42”).",
      "Tap Capture.",
      "Your task appears, sorted with a reminder set.",
    ],
  },
  {
    slug: "snooze",
    title: "Snooze a reminder",
    blurb: "Not the right moment? Push any task to later in a single tap.",
    steps: [
      "Tap Snooze on any task.",
      "Pick when to be nudged again (this evening, tomorrow, the weekend…).",
      "It steps aside and comes back at the time you chose.",
    ],
  },
  {
    slug: "snap-photo",
    title: "Snap a photo",
    blurb:
      "Photograph a letter, bill or flyer and nudge reads it — turning every action inside into its own task.",
    steps: [
      "Tap Photo in the capture box and snap (or pick) the image.",
      "nudge reads the text on it.",
      "Each thing to do becomes a dated task.",
    ],
  },
];

export default function GuidesPage() {
  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>How-to guides</h1>
        <p className="note">
          Short, silent clips showing the basics. Looking for what the
          categories mean? See <Link href="/help">Categories &amp; help</Link>.
        </p>
      </div>

      <div className="guides-grid">
        {GUIDES.map((g) => (
          <section className="panel guide-card" key={g.slug}>
            <img
              className="guide-video"
              src={`/guides/${g.slug}.svg`}
              alt={`How to ${g.title.toLowerCase()} in nudge`}
              loading="lazy"
            />
            <div className="guide-copy">
              <h2 className="section">{g.title}</h2>
              <p className="note">{g.blurb}</p>
              <ol className="guide-steps">
                {g.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
