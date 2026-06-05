/** Shown to brand-new users (empty timeline) to teach the capture habit. */
export default function Onboarding({
  inboundAddress,
}: {
  inboundAddress?: string | null;
}) {
  return (
    <div className="onboard">
      <h2>Welcome to nudge 👋</h2>
      <p>
        Drop in anything you don&apos;t want to carry in your head — nudge pulls
        out what matters and reminds you before it slips. Try one of these:
      </p>
      <ul className="onboard-list">
        <li>
          <span>📋</span> Paste a message, email or newsletter into the box above
        </li>
        <li>
          <span>📷</span> Upload a photo of a letter, poster or bill
        </li>
        <li>
          <span>🎤</span> Record a quick voice note
        </li>
        <li>
          <span>✉️</span> Forward an email to{" "}
          {inboundAddress ? <code>{inboundAddress}</code> : "your nudge address"}
        </li>
      </ul>
      <p className="note">Your first tasks will appear here.</p>
    </div>
  );
}
