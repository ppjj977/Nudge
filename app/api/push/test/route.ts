import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToUser, pushEnabled } from "@/lib/push";
import { sendFcmToUser, fcmEnabled } from "@/lib/fcm";
import { sendEmail } from "@/lib/email";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/push/test — send a test notification to BOTH channels so the user
 * can verify push and email independently. Reports what each channel did.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = {
    title: "🔔 nudge test",
    body: "Notifications are working. You'll be nudged before things are due.",
    url: "/",
  };
  let delivered = 0;
  if (pushEnabled()) delivered = await sendPushToUser(user.id, payload);
  let fcmDelivered = 0;
  if (fcmEnabled()) fcmDelivered = await sendFcmToUser(user.id, payload);

  let emailSent = false;
  if (config.email.resendApiKey) {
    emailSent = await sendEmail({
      to: user.email,
      subject: "🔔 nudge test",
      text: "This is a test from nudge. If you got this, email reminders will work.",
      html: '<div style="font-family:system-ui,sans-serif"><h2>🔔 nudge test</h2><p>If you got this, email reminders will work.</p></div>',
    });
  }

  return NextResponse.json({
    to: user.email,
    push: { configured: pushEnabled(), delivered },
    fcm: { configured: fcmEnabled(), delivered: fcmDelivered },
    email: { configured: Boolean(config.email.resendApiKey), sent: emailSent },
  });
}
