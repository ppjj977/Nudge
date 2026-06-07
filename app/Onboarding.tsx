/** Shown to brand-new users (empty timeline) to teach the capture habit. */
export default function Onboarding({
  inboundAddress,
}: {
  inboundAddress?: string | null;
}) {
  return (
    <div className="onboard">
      <h2>This is your reminder safety net 🪂</h2>
      <p>
        Send Nudge anything you&apos;re trying to hold in your head — it pulls out
        the task, date and amount, and reminds you before it slips. Use the box
        above (tap an example to see it work), or:
      </p>
      <ul className="onboard-list">
        <li>
          <span>📷</span> Snap a photo of a letter, poster or bill
        </li>
        <li>
          <span>🎤</span> Record a quick voice note
        </li>
        <li>
          <span>✉️</span> Forward an email to{" "}
          {inboundAddress ? <code>{inboundAddress}</code> : "your nudge address"}
        </li>
      </ul>
      <p className="note">Whatever you capture appears here as a reminder.</p>
    </div>
  );
}
