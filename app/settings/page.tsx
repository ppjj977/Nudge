import Link from "next/link";
import { getOrCreateDefaultUser } from "@/lib/users";
import { parseUserSettings, DEFAULT_REMINDER_RULES } from "@/lib/reminders";
import { pushEnabled } from "@/lib/push";
import SettingsForm from "../SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getOrCreateDefaultUser();
  const { rules, channels } = parseUserSettings(user);

  return (
    <>
      <div className="settings-head">
        <Link href="/" className="back">
          ← Timeline
        </Link>
        <h1>Nudge preferences</h1>
      </div>
      <SettingsForm
        initialRules={rules}
        defaults={DEFAULT_REMINDER_RULES}
        initialChannels={channels}
        initialDigestHour={user.digest_hour}
        pushAvailable={pushEnabled()}
      />
    </>
  );
}
