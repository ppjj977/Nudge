import { db, ensureSchema } from "./db";
import { newId } from "./ids";

/**
 * Named circular geofences (home, school, work, …). A task can be linked to a
 * place + a trigger ('arrive' | 'leave') for a location-based alert. The native
 * app registers these as geofences and fires the alert on enter/exit.
 */
export const DEFAULT_RADIUS_M = 150;
export const MIN_RADIUS_M = 80;
export const MAX_RADIUS_M = 2000;

export interface Place {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  created_at: string;
}

export async function listPlaces(userId: string): Promise<Place[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT * FROM places WHERE user_id = ? ORDER BY created_at ASC",
    args: [userId],
  });
  return res.rows as unknown as Place[];
}

export async function createPlace(
  userId: string,
  input: { name: string; lat: number; lng: number; radius?: number },
): Promise<Place | null> {
  await ensureSchema();
  const name = input.name.trim();
  if (!name) return null;
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) return null;
  const radius = Math.min(
    MAX_RADIUS_M,
    Math.max(MIN_RADIUS_M, Math.round(input.radius || DEFAULT_RADIUS_M)),
  );
  const id = newId("plc");
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO places (id, user_id, name, lat, lng, radius, created_at)
          VALUES (?,?,?,?,?,?,?)`,
    args: [id, userId, name, input.lat, input.lng, radius, now],
  });
  return { id, user_id: userId, name, lat: input.lat, lng: input.lng, radius, created_at: now };
}

export async function deletePlace(userId: string, id: string): Promise<void> {
  await ensureSchema();
  // Unlink any tasks pointing at it, then delete the place.
  await db.execute({
    sql: "UPDATE tasks SET place_id = NULL, geo_trigger = NULL WHERE place_id = ? AND user_id = ?",
    args: [id, userId],
  });
  await db.execute({
    sql: "DELETE FROM places WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}
