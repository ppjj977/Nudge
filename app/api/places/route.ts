import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listPlaces, createPlace, deletePlace } from "@/lib/places";

export const runtime = "nodejs";

/** GET /api/places — the user's saved places (geofences). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ places: await listPlaces(user.id) });
}

/** POST /api/places { name, lat, lng, radius? } — save a place. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, lat, lng, radius } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "name, lat and lng are required" }, { status: 400 });
  }
  const place = await createPlace(user.id, { name, lat, lng, radius });
  if (!place) return NextResponse.json({ error: "Couldn’t save that place." }, { status: 400 });
  return NextResponse.json({ ok: true, place });
}

/** DELETE /api/places?id=… — remove a place (and unlink its tasks). */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePlace(user.id, id);
  return NextResponse.json({ ok: true });
}
