import { NextResponse } from "next/server";
import { updateUserSettings, getUserLifeAreas } from "@/lib/users";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_LIFE_AREAS } from "@/lib/categories";
import {
  parseUserSettings,
  regenerateAllForUser,
  isValidRule,
  DEFAULT_REMINDER_RULES,
  type ReminderRule,
} from "@/lib/reminders";
import { pushEnabled } from "@/lib/push";
import { CATEGORIES, type Category } from "@/lib/categories";

export const runtime = "nodejs";

/** GET /api/settings — resolved reminder rules + channels + digest hour. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rules, channels } = parseUserSettings(user);
  return NextResponse.json({
    reminderRules: rules,
    channels,
    digestHour: user.digest_hour,
    lifeAreas: getUserLifeAreas(user),
    defaults: DEFAULT_REMINDER_RULES,
    defaultLifeAreas: DEFAULT_LIFE_AREAS,
    pushAvailable: pushEnabled(),
  });
}

interface SettingsBody {
  reminderRules?: Record<string, unknown>;
  channels?: { email?: unknown; push?: unknown };
  digestHour?: unknown;
  lifeAreas?: unknown;
}

/** PUT /api/settings — save preferences, then regenerate active reminders. */
export async function PUT(req: Request) {
  let body: SettingsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Sanitize rules: keep only known categories and well-formed rules.
  const reminderRules: Partial<Record<Category, ReminderRule[]>> = {};
  const incoming = body.reminderRules ?? {};
  for (const cat of CATEGORIES) {
    const v = (incoming as Record<string, unknown>)[cat];
    if (Array.isArray(v)) {
      reminderRules[cat] = v
        .filter(isValidRule)
        .map((r) => ({ daysBefore: Math.trunc(r.daysBefore), time: r.time }));
    }
  }

  const channels = {
    email: Boolean(body.channels?.email),
    push: Boolean(body.channels?.push),
  };

  let digestHour: number | undefined;
  if (typeof body.digestHour === "number") {
    digestHour = Math.min(23, Math.max(0, Math.trunc(body.digestHour)));
  }

  // Sanitize life areas: trimmed, lowercased, de-duped, non-empty. Fall back to
  // defaults if the user cleared them all (so the extractor always has a set).
  let lifeAreas = DEFAULT_LIFE_AREAS;
  if (Array.isArray(body.lifeAreas)) {
    const cleaned = Array.from(
      new Set(
        body.lifeAreas
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim().toLowerCase())
          .filter((a) => a.length > 0),
      ),
    );
    if (cleaned.length > 0) lifeAreas = cleaned;
  }

  await updateUserSettings(
    user.id,
    { reminderRules, channels, lifeAreas },
    digestHour,
  );

  // Apply the new schedule to existing active tasks.
  await regenerateAllForUser(user.id);

  return NextResponse.json({ ok: true });
}
