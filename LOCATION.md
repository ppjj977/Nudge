# Location alerts (geofencing)

Get nudged when you **arrive at** or **leave** a saved place — e.g. *"leaving
home → did you grab the parcel to return?"*

## What's built (web — live + testable)

- **Places** — named circular geofences (Home/School/Work…). Manage at `/places`:
  name + "use my current location" + radius (80–2000 m). Table: `places`.
- **Linking** — in the task editor, **"Alert me at a place"** + **"When I arrive /
  leave"** sets `tasks.place_id` + `tasks.geo_trigger`. A 📍 chip shows on the card.
- **`GET /api/geofences`** — the user's active rules (task ↔ place ↔ trigger) +
  the transition URL, for the native app to register. `lib/geofences.ts`.

## Native background geofencing — WIRED (needs a device build to verify)

The native firing is wired up via `@capgo/background-geolocation`. It can't be
compiled/tested in the web env, so treat the first Android build as a shakedown —
but everything is in place:

- **Plugin** installed in `.github/workflows/android.yml`.
- **Permissions** added to the manifest by `native/patch-geofence.js`
  (`ACCESS_FINE/COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `POST_NOTIFICATIONS`).
- **Registration** on launch: `app/NativeGeofence.tsx` calls `setupGeofencing` +
  `addGeofence` per rule from `GET /api/geofences`.
- **Background firing**: the plugin POSTs transitions (even while suspended) to
  `POST /api/geofences/transition?t=<token>`, which maps the task and sends the
  push ("📍 Leaving Home — return the parcel"). Token-authed (no session in bg).

### To ship it
1. Run the **Build Android** GitHub Action → install the new APK (uninstall the
   old one first — signing mismatch).
2. On device: open Nudge → allow location **"Always"** + notifications, add a
   Place, link a task with arrive/leave, then cross the boundary.
3. **Google Play**: complete the **background-location prominent disclosure** +
   data-safety form. ⚠️ Do this **after** your first app approval — adding
   background location to the pending submission can slow/complicate review.

### Verify / likely to tweak on first build
- **Transition POST body shape** — `app/api/geofences/transition` reads
  `{ identifier, transition|enter, payload }`. If the plugin posts a different
  shape, adjust the parser (check Render logs for the incoming body).
- Android caps geofences at 100/device (fine here); geofences are OS-managed and
  battery-cheap.
- If background updates stall, the plugin docs mention `android.useLegacyBridge` —
  only add it if needed (it changes the WebView bridge).
