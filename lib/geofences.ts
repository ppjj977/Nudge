import { db, ensureSchema } from "./db";

/**
 * The active geofence rules for a user: each is an active task linked to a place
 * with an arrive/leave trigger. The native app pulls these on launch, registers
 * a geofence per place, and fires the task's alert on the matching transition.
 */
export interface GeofenceRule {
  taskId: string;
  taskTitle: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  radius: number;
  trigger: "arrive" | "leave";
}

export async function listGeofencesForUser(userId: string): Promise<GeofenceRule[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT t.id AS taskId, t.title AS taskTitle, t.geo_trigger AS trigger,
                 p.id AS placeId, p.name AS placeName, p.lat AS lat, p.lng AS lng, p.radius AS radius
          FROM tasks t
          JOIN places p ON p.id = t.place_id
          WHERE t.user_id = ? AND t.status = 'active'
            AND t.place_id IS NOT NULL AND t.geo_trigger IS NOT NULL`,
    args: [userId],
  });
  return res.rows.map((r) => {
    const row = r as unknown as {
      taskId: string;
      taskTitle: string;
      trigger: string;
      placeId: string;
      placeName: string;
      lat: number;
      lng: number;
      radius: number;
    };
    return {
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      placeId: row.placeId,
      placeName: row.placeName,
      lat: Number(row.lat),
      lng: Number(row.lng),
      radius: Number(row.radius),
      trigger: row.trigger === "leave" ? "leave" : "arrive",
    };
  });
}
