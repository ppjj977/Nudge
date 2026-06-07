# Location alerts (geofencing)

Get nudged when you **arrive at** or **leave** a saved place — e.g. *"leaving
home → did you grab the parcel to return?"*

## What's built (web — live + testable)

- **Places** — named circular geofences (Home/School/Work…). Manage at `/places`:
  name + "use my current location" + radius (80–2000 m). Table: `places`.
- **Linking** — in the task editor, **"Alert me at a place"** + **"When I arrive /
  leave"** sets `tasks.place_id` + `tasks.geo_trigger`. A 📍 chip shows on the card.
- **`GET /api/geofences`** — returns the user's active rules (task ↔ place ↔
  trigger) for the device to register. `lib/geofences.ts`.

This all works now. The only missing piece is the **native part that actually
fires the alert in the background**, below.

## What's left: native background geofencing (needs a device build)

True "fire when I cross the boundary while the app is closed" requires native
background location. It **can't be built/tested in the web env** — it needs a
signed APK + on-device testing + a Play disclosure.

### Steps to enable

1. **Add the plugin** to the install step in `.github/workflows/android.yml`:
   `npm i @capgo/background-geolocation` (supports native geofences + posting
   transitions while the WebView is suspended).
2. **Permissions** — a patch script (mirror `native/patch-gradle.js`) that adds to
   the generated `AndroidManifest.xml`:
   `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
   `POST_NOTIFICATIONS`.
3. **Register on launch** — a client module (like `NativePush`) that, on a native
   platform: requests location permission, `GET /api/geofences`, and registers a
   geofence per rule; on the matching enter/exit transition, posts a local
   notification with the task title (e.g. *"Leaving Home — did you grab: return
   the parcel?"*). Re-sync on app resume and after task/place edits.
4. **Google Play** — complete the **background-location prominent disclosure** +
   data-safety form. ⚠️ Do this **after** your first app approval — adding
   background location to the pending submission can slow/complicate review.

### Notes
- Android caps geofences at 100/device — fine here.
- Battery: geofences are OS-managed and cheap; avoid continuous tracking.
- The web foundation doesn't depend on any of this, so it can be switched on
  whenever you're ready without rework.
