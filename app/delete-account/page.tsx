import Link from "next/link";
import { config } from "@/lib/config";

export const metadata = { title: "nudge — Delete your account" };

/**
 * Public account-deletion instructions for the Google Play Data safety form
 * (the "Delete account URL"). Must be readable without signing in, name the
 * app, give the steps, and state what's deleted/kept + retention.
 */
export default function DeleteAccountPage() {
  const email = config.supportEmail;
  return (
    <div className="legal">
      <div className="settings-head">
        <Link href="/" className="back">
          ← Home
        </Link>
        <h1>Delete your nudge account</h1>
      </div>
      <p className="legal-updated">Last updated: 8 June 2026</p>

      <p>
        This page explains how to delete your <strong>nudge</strong> account
        (nudgelive.co.uk) and the data associated with it.
      </p>

      <h2>Delete it yourself, in the app</h2>
      <ol>
        <li>Open nudge and sign in.</li>
        <li>
          Go to <strong>Profile</strong> (top-right menu →{" "}
          <strong>Profile</strong>).
        </li>
        <li>
          Scroll to <strong>Delete account</strong>.
        </li>
        <li>
          Type <strong>DELETE</strong> to confirm, then tap{" "}
          <strong>Permanently delete</strong>.
        </li>
      </ol>
      <p>
        This takes effect immediately and cannot be undone.
      </p>

      <h2>Or request deletion by email</h2>
      <p>
        Email <a href={`mailto:${email}`}>{email}</a> from the address on your
        account and ask us to delete it. We’ll action it and confirm.
      </p>

      <h2>What’s deleted</h2>
      <p>
        Deleting your account <strong>permanently removes all of your data</strong>,
        including:
      </p>
      <ul>
        <li>Your account details (name, email, password).</li>
        <li>Everything you’ve captured (text, photos, voice notes, forwarded emails).</li>
        <li>Your tasks, reminders and lists.</li>
        <li>Saved places (geofence locations), if any.</li>
        <li>Push-notification tokens and sign-in sessions.</li>
      </ul>
      <p>
        If you created a family group, it’s handed to another member or removed if
        you were the only one in it.
      </p>

      <h2>What’s kept, and for how long</h2>
      <p>
        Nothing is retained after account deletion for your account’s own data.
        Separately, while your account is active, <strong>raw captures are
        automatically purged after 30 days</strong> (the extracted tasks remain
        until you complete or delete them). We may keep minimal records only where
        required by law (for example, basic transaction records for a purchase).
      </p>

      <p className="legal-foot">
        <Link href="/privacy">Privacy Policy</Link> ·{" "}
        <Link href="/data-safety">Data Safety</Link> ·{" "}
        <Link href="/terms">Terms of Service</Link>
      </p>
    </div>
  );
}
