# Native Android app (Capacitor + FCM push)

The web app already ships as a PWA/TWA. This sets up a **Capacitor** Android
wrapper so push arrives as **first-class, app-branded notifications** via
Firebase Cloud Messaging (no Chrome branding / spam UI).

The web app loads remotely (`server.url = https://nudgelive.co.uk`), so there's
nothing to export — the native shell just adds the FCM plugin. The server side
(token storage, `/api/push/fcm/register`, sending via FCM, dispatcher wiring) is
already in this repo.

## 1. Firebase project (free)
1. https://console.firebase.google.com → **Add project** (e.g. "nudge").
2. **Add app → Android.** Package name: **`uk.co.nudgelive.app`** (must match
   `capacitor.config.json`). Download **`google-services.json`**.
3. **Project settings → Service accounts → Generate new private key** → download
   the JSON.

## 2. Server env (Render)
Set **`FCM_SERVICE_ACCOUNT`** to that service-account JSON (paste raw, or
base64-encode it first). Save → redeploy. Test push then has a delivery path.

## 3. Build the Android app (needs Node + Android Studio / JDK 17)
```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android @capacitor/push-notifications
npx cap add android
# put google-services.json in android/app/
npx cap sync
npx cap open android     # opens Android Studio
```
In Android Studio: let Gradle sync, then **Build → Generate Signed Bundle/APK**.
- Reuse your existing keystore (the one PWABuilder made) or create a new one —
  just keep it safe for future updates.
- Produce an **`.apk`** (sideload/test) and an **`.aab`** (Play Store).

## 4. Verify
- Install the APK, sign in, allow the notification prompt (native Android
  dialog), then **Settings → Send test** — it should arrive as **nudge** (app
  icon), managed in Android **Settings → Apps → nudge → Notifications**.

## Notes
- This is a **different package** (`…app`) from the PWABuilder TWA (`…twa`). For
  the Play Store, publish this Capacitor build as the app (the TWA was interim).
- `NativePush.tsx` registers the device token (`/api/push/fcm/register`) on
  launch when running natively; in a browser it's a no-op.
- Reminders/digests already fan out to FCM tokens alongside web push + email.
