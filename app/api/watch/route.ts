import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createWatch, listWatches, deleteWatch, FREE_WATCH_LIMIT } from "@/lib/watch";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** GET /api/watch — list the user's watches. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ watches: await listWatches(user.id) });
}

/** POST /api/watch { url, condition, label? } — create a watch. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimited(`watch:${clientIp(req)}`, 20, 60_000);
  if (limited) return limited;

  const { url, condition, label } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || typeof condition !== "string") {
    return NextResponse.json({ error: "url and condition are required" }, { status: 400 });
  }

  const result = await createWatch(user.id, { url, condition, label });
  if (!result.ok) {
    if (result.reason === "limit") {
      return NextResponse.json(
        {
          error: `You've reached your watch limit (${FREE_WATCH_LIMIT} on the free plan). Upgrade to Pro for more.`,
          upgrade: true,
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "That doesn’t look like a valid web address." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, watch: result.watch });
}

/** DELETE /api/watch?id=… — remove a watch. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteWatch(user.id, id);
  return NextResponse.json({ ok: true });
}
