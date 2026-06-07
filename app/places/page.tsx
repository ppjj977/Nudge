import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPlaces } from "@/lib/places";
import PlacesManager from "../PlacesManager";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const user = await requireUser();
  const places = await listPlaces(user.id);

  return (
    <div className="container">
      <div className="settings-head">
        <Link href="/" className="back">← Timeline</Link>
        <h1>Places</h1>
        <p className="note">
          Save the spots that matter — home, school, work. Then link a task to
          arriving at or leaving a place to get a nudge at exactly the right moment
          (e.g. “leaving home → did you grab the parcel to return?”).
        </p>
      </div>
      <PlacesManager
        initial={places.map((p) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          radius: p.radius,
        }))}
      />
    </div>
  );
}
