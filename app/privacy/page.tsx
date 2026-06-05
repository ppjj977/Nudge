import Link from "next/link";
import { config } from "@/lib/config";

export const metadata = { title: "nudge — Privacy Policy" };

export default function PrivacyPage() {
  const email = config.supportEmail;
  return (
    <div className="legal">
      <div className="settings-head">
        <Link href="/" className="back">
          ← Home
        </Link>
        <h1>Privacy Policy</h1>
      </div>
      <p className="legal-updated">Last updated: 5 June 2026</p>

      <p>
        nudge (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps you capture things and
        be reminded about them. This policy explains what we collect, why, and
        the choices you have. We aim to collect as little as possible.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, and a
          securely hashed password (we never store your password in plain text).
        </li>
        <li>
          <strong>What you capture:</strong> the text, images, voice notes and
          forwarded emails you send to nudge, and the tasks we extract from them.
        </li>
        <li>
          <strong>Family:</strong> if you join a family, your membership and the
          tasks you choose to share with it.
        </li>
        <li>
          <strong>Notifications:</strong> push-notification subscriptions for
          devices you enable them on.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To turn your captures into tasks and reminders.</li>
        <li>To send you reminders, a daily digest, sign-in links, and family invites.</li>
        <li>To operate, secure and improve the service.</li>
      </ul>
      <p>We do not sell your data, and we don&apos;t show ads.</p>

      <h2>Service providers</h2>
      <p>
        We share data only with providers that help us run nudge, acting on our
        instructions:
      </p>
      <ul>
        <li>
          <strong>Groq</strong> — processes your captured text/images/audio to
          extract tasks.
        </li>
        <li>
          <strong>Resend</strong> — sends and receives email on our behalf.
        </li>
        <li>
          <strong>Render</strong> &amp; <strong>Turso</strong> — hosting and
          database.
        </li>
      </ul>

      <h2>Retention</h2>
      <p>
        Raw captures are temporary and are purged after a short retention period;
        the resulting tasks remain until you complete or delete them. You can
        delete your entire account and all associated data at any time from{" "}
        <strong>Profile → Delete account</strong>, which removes it permanently.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS), passwords are hashed with scrypt,
        and sessions use secure, http-only cookies.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access and update your details in Profile, and delete your
        account and data at any time. For any privacy request, contact us at{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>

      <h2>Children</h2>
      <p>nudge isn&apos;t intended for children under 13.</p>

      <h2>Changes</h2>
      <p>
        We may update this policy; we&apos;ll change the date above when we do.
      </p>

      <p className="legal-foot">
        <Link href="/terms">Terms of Service</Link>
      </p>
    </div>
  );
}
