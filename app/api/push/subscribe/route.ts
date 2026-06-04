import { NextResponse } from "next/server";
import { getOrCreateDefaultUser } from "@/lib/users";
import { saveSubscription, deleteSubscription } from "@/lib/push";

export const runtime = "nodejs";

/** POST /api/push/subscribe — register this device's push subscription. */
export async function POST(req: Request) {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: "endpoint and keys{p256dh,auth} are required" },
      { status: 400 },
    );
  }
  const user = await getOrCreateDefaultUser();
  await saveSubscription(user.id, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe — remove a device subscription. */
export async function DELETE(req: Request) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }
  await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
