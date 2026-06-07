# Location reminders

Two layers, shipped in stages.

## 1. Leave-by reminders (live now, web-only) ✅

For a task that has **a time + a place**, you can set a **"Leave-by (mins
before)"** value in the task editor. Nudge then schedules an extra reminder that
many minutes before the due time — *"🚗 Time to leave — &lt;task&gt;"* with the
location — on top of the normal reminders.

- Stored in `tasks.leave_minutes`.
- Scheduled in `generateRemindersForTask` (a reminder row with `kind = 'leave'`).
- Formatted in `lib/dispatch.ts` (`leaveEmail` + the leave-by push payload).
- No background location, no new permission, no Play disclosure — works on web
  + the existing app.

## 2. True geofencing — "remind me when I arrive" (scaffold only)

The **data + API are ready**, but the native background-location piece is
deliberately **not** enabled (it triggers a Google Play *prominent disclosure*
and a stricter data-safety review, which would attach to your current Play
submission).

Already in place:
- Columns `tasks.geo_lat`, `tasks.geo_lng`, `tasks.remind_on_arrival`.
- `GET /api/geofences` → the user's active arrival-reminder geofences
  (`lib/geofences.ts`). Returns `[]` until coordinates are set.

### To enable it later (small, well-defined steps)

1. **Geocoding** — turn the task's `location` text into `geo_lat/geo_lng`
   (Google Geocoding or OpenStreetMap Nominatim). Store on the task; expose a
   "remind me when I arrive" toggle in the editor that sets `remind_on_arrival`.
2. **Native plugin** — add `@capgo/background-geolocation` to the install step in
   `.github/workflows/android.yml`, and a patch script that adds
   `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` and `POST_NOTIFICATIONS`
   to the generated `AndroidManifest.xml` (mirror `native/patch-gradle.js`).
3. **Register on launch** — a small client module (like `NativePush`) calls
   `GET /api/geofences` and registers a circular geofence per item; the plugin
   posts a local notification on entry even while the WebView is suspended.
4. **Play Console** — complete the background-location *prominent disclosure* and
   data-safety form before submitting. Do this **after** the app is approved, to
   avoid complicating the first review.

Nothing in the leave-by path depends on this, so it can be turned on whenever
you're ready without reworking anything.
