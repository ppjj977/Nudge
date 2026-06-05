import Link from "next/link";
import { getUserLifeAreas } from "@/lib/users";
import { requireUser } from "@/lib/auth";
import { parseUserSettings, DEFAULT_REMINDER_RULES } from "@/lib/reminders";
import { DEFAULT_LIFE_AREAS } from "@/lib/categories";
import { pushEnabled } from "@/lib/push";
import { isPro } from "@/lib/plan";
import SettingsForm from "../SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const { rules, channels, digest } = parseUserSettings(user);

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
        initialDigest={digest}
        initialDigestHour={user.digest_hour}
        initialLifeAreas={getUserLifeAreas(user)}
        defaultLifeAreas={DEFAULT_LIFE_AREAS}
        pushAvailable={pushEnabled()}
        pro={isPro(user)}
      />
    </>
  );
}
