import Link from "next/link";

export const metadata = { title: "nudge — Terms of Service" };

export default function TermsPage() {
  return (
    <div className="legal">
      <div className="settings-head">
        <Link href="/" className="back">
          ← Home
        </Link>
        <h1>Terms of Service</h1>
      </div>
      <p className="legal-updated">Last updated: 5 June 2026</p>

      <p>
        By creating an account or using nudge, you agree to these terms. If you
        don&apos;t agree, please don&apos;t use the service.
      </p>

      <h2>The service</h2>
      <p>
        nudge captures things you send it and reminds you about them. Reminders
        are provided on a best-effort basis — please don&apos;t rely on nudge
        alone for safety-critical or legally important deadlines.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login details secure and provide accurate information. You&apos;re
        responsible for activity under your account. You can delete it at any
        time from Profile.
      </p>

      <h2>Your content</h2>
      <p>
        Your captures and tasks remain yours. You grant us permission to process
        them (including via the service providers in our{" "}
        <Link href="/privacy">Privacy Policy</Link>) solely to provide nudge to
        you. Only share family content with people you trust.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use nudge for anything unlawful, abusive, or that infringes
        others&apos; rights, and don&apos;t attempt to disrupt or misuse the
        service (including its email features).
      </p>

      <h2>Availability &amp; liability</h2>
      <p>
        nudge is provided &ldquo;as is&rdquo;, without warranties. To the extent
        permitted by law, we aren&apos;t liable for missed reminders, lost data,
        or other indirect or consequential losses.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using nudge and delete your account at any time. We may
        suspend or end access where these terms are breached.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; we&apos;ll change the date above when we do.</p>

      <p className="legal-foot">
        Questions? <a href="mailto:hello@nudgelive.co.uk">hello@nudgelive.co.uk</a>
      </p>
    </div>
  );
}
