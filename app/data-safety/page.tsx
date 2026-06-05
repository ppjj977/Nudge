import Link from "next/link";
import { config } from "@/lib/config";

export const metadata = { title: "nudge — Data Safety" };

/**
 * Public data-safety summary. Doubles as the answer key for the Google Play
 * "Data safety" form. Kept in sync with the Privacy Policy.
 */
export default function DataSafetyPage() {
  const email = config.supportEmail;
  return (
    <div className="legal">
      <div className="settings-head">
        <Link href="/" className="back">
          ← Home
        </Link>
        <h1>Data Safety</h1>
      </div>
      <p className="legal-updated">Last updated: 5 June 2026</p>

      <p>
        A plain-English summary of the data nudge handles. We collect as little
        as possible, never sell it, and show no ads. Full detail is in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>What we collect, and why</h2>
      <div className="data-table" role="table">
        <div className="dt-head" role="row">
          <span>Data</span>
          <span>Collected</span>
          <span>Shared</span>
          <span>Purpose</span>
        </div>
        {[
          ["Name", "Yes", "No", "Account, personalisation"],
          ["Email address", "Yes", "No", "Account, reminders, sign-in & family invites"],
          ["Your captures (text, photos, voice notes, forwarded emails)", "Yes", "No", "Extract your tasks (app functionality)"],
          ["Tasks & lists you create", "Yes", "No", "Core app functionality"],
          ["Push notification token", "Yes", "No", "Send reminders to your device"],
        ].map((r) => (
          <div className="dt-row" role="row" key={r[0]}>
            <span data-l="Data">{r[0]}</span>
            <span data-l="Collected">{r[1]}</span>
            <span data-l="Shared">{r[2]}</span>
            <span data-l="Purpose">{r[3]}</span>
          </div>
        ))}
      </div>
      <p className="note">
        &ldquo;Shared&rdquo; means transferred to a third party for their own
        use — we do not do this. We do use trusted{" "}
        <strong>service providers</strong> who process data only on our
        instructions (below).
      </p>

      <h2>Service providers (processors)</h2>
      <ul>
        <li>
          <strong>Groq</strong> — processes your captured text, images and audio
          to extract tasks. Not used to train their models on your behalf.
        </li>
        <li>
          <strong>Resend</strong> — sends and receives email (reminders, digests,
          invites, and your email-in address).
        </li>
        <li>
          <strong>Firebase Cloud Messaging (Google)</strong> — delivers push
          notifications.
        </li>
        <li>
          <strong>Render</strong> &amp; <strong>Turso</strong> — hosting and
          database.
        </li>
      </ul>

      <h2>Security</h2>
      <ul>
        <li>Encrypted in transit (HTTPS).</li>
        <li>Passwords hashed with scrypt — never stored in plain text.</li>
        <li>Sessions use secure, http-only cookies.</li>
      </ul>

      <h2>Your control & deletion</h2>
      <p>
        Raw captures are temporary and purged after a short retention period.
        You can delete your entire account and all associated data at any time
        from <strong>Profile → Delete account</strong>, or request deletion by
        emailing <a href={`mailto:${email}`}>{email}</a>.
      </p>

      <hr className="legal-rule" />

      <h2>Google Play “Data safety” — quick answers</h2>
      <p className="note">
        For completing the Play Console Data safety form.
      </p>
      <ul>
        <li>Does the app collect or share user data? <strong>Yes (collects).</strong></li>
        <li>Is data encrypted in transit? <strong>Yes.</strong></li>
        <li>Can users request data deletion? <strong>Yes (in-app + by email).</strong></li>
        <li>
          Data types collected: <strong>Personal info</strong> (name, email
          address); <strong>Photos</strong> and <strong>Audio</strong> (only the
          ones you capture); <strong>Files &amp; docs / other user content</strong>{" "}
          (captured text and forwarded emails, tasks and lists);{" "}
          <strong>Device or other IDs</strong> (push token).
        </li>
        <li>
          Purposes: <strong>App functionality</strong> and{" "}
          <strong>account management</strong> only. No analytics-for-advertising,
          no data sold or shared for third-party use.
        </li>
      </ul>

      <p className="legal-foot">
        <Link href="/privacy">Privacy Policy</Link> ·{" "}
        <Link href="/terms">Terms of Service</Link>
      </p>
    </div>
  );
}
