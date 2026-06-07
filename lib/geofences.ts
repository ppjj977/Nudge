import { db, ensureSchema } from "./db";

/**
 * Geofence scaffold (arrival reminders). The data + this endpoint are ready so
 * that turning on true "remind me when I arrive" later is a small step: ship a
 * background-geolocation plugin in the native build, have the app pull this list
 * on launch and register a geofence per item, and post the reminder on entry.
 *
 * NOT yet wired to any native permission — see LOCATION.md for the enable path.
 */
export const DEFAULT_GEOFENCE_RADIUS_M = 150;

export interface Geofence {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  label: string;
}

/** A user's active arrival-reminder tasks that have coordinates set. */
export async function listGeofencesForUser(userId: string): Promise<Geofence[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT id, title, geo_lat, geo_lng FROM tasks
          WHERE user_id = ? AND status = 'active'
            AND remind_on_arrival = 1 AND geo_lat IS NOT NULL AND geo_lng IS NOT NULL`,
    args: [userId],
  });
  return res.rows.map((r) => {
    const row = r as unknown as { id: string; title: string; geo_lat: number; geo_lng: number };
    return {
      id: row.id,
      lat: Number(row.geo_lat),
      lng: Number(row.geo_lng),
      radius: DEFAULT_GEOFENCE_RADIUS_M,
      label: row.title,
    };
  });
}
