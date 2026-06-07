"use client";

import { useEffect } from "react";

/**
 * Registers the user's place-based geofences with the native plugin
 * (@capgo/background-geolocation) on app launch. Transitions are POSTed by the
 * plugin to /api/geofences/transition (works while suspended), which sends the
 * push. No-op in a normal browser / before the native build ships the plugin.
 */
interface GeofencePlugin {
  setupGeofencing: (o: Record<string, unknown>) => Promise<void>;
  addGeofence: (o: Record<string, unknown>) => Promise<void>;
  removeAllGeofences: () => Promise<void>;
}
type Cap = {
  isNativePlatform?: () => boolean;
  Plugins?: { BackgroundGeolocation?: GeofencePlugin };
};
interface Rule {
  taskId: string;
  taskTitle: string;
  placeName: string;
  lat: number;
  lng: number;
  radius: number;
  trigger: "arrive" | "leave";
}

export default function NativeGeofence() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const BG = cap.Plugins?.BackgroundGeolocation;
    if (!BG) return;

    (async () => {
      try {
        const res = await fetch("/api/geofences");
        if (!res.ok) return;
        const data = (await res.json()) as { geofences?: Rule[]; transitionUrl?: string };
        const rules = data.geofences ?? [];

        await BG.setupGeofencing({
          url: data.transitionUrl,
          requestPermissions: true,
          backgroundLocation: true,
          notifyOnEntry: true,
          notifyOnExit: true,
        });

        // Reconcile: clear then re-add the current rules.
        await BG.removeAllGeofences().catch(() => {});
        for (const r of rules) {
          await BG.addGeofence({
            identifier: r.taskId,
            latitude: r.lat,
            longitude: r.lng,
            radius: r.radius,
            notifyOnEntry: r.trigger === "arrive",
            notifyOnExit: r.trigger === "leave",
            payload: { title: r.taskTitle, placeName: r.placeName, trigger: r.trigger },
          }).catch(() => {});
        }
      } catch {
        /* native geofencing unavailable — ignore */
      }
    })();
  }, []);

  return null;
}
