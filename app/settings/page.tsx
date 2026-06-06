import Link from "next/link";
import { getUserLifeAreas } from "@/lib/users";
import { requireUser } from "@/lib/auth";
import { parseUserSettings, DEFAULT_REMINDER_RULES } from "@/lib/reminders";
import { DEFAULT_LIFE_AREAS } from "@/lib/categories";
import { pushEnabled } from "@/lib/push";
import { isPro } from "@/lib/plan";
import { config } from "@/lib/config";
import { getOrCreateLinkCode, linkDeepLink } from "@/lib/whatsapp";
import SettingsForm from "../SettingsForm";
import WhatsAppConnect from "../WhatsAppConnect";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const { rules, channels, digest } = parseUserSettings(user);

  // WhatsApp capture appears once a Nudge business number is configured.
  const waEnabled = Boolean(config.whatsapp.displayNumber);
  const waCode = waEnabled ? await getOrCreateLinkCode(user) : "";
  const waMasked = user.whatsapp_number ? `••• ${user.whatsapp_number.slice(-4)}` : null;

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
      {waEnabled && (
        <WhatsAppConnect
          connected={Boolean(user.whatsapp_number)}
          maskedNumber={waMasked}
          code={waCode}
          deepLink={linkDeepLink(waCode)}
          displayNumber={config.whatsapp.displayNumber ?? null}
        />
      )}
    </>
  );
}
