# nudge — Google Play submission answer key

Verified against the code (release build = `android-release.yml`). Marketing copy
lives in `STORE_LISTING.md`; this is the operational "what to type into each Play
Console field" doc. Keep it true.

## ⚠️ Standing decision: no location in the store build
The Play AAB ships **no location permission / geofence plugin** (only debug
`android.yml` adds them). So all Data Safety answers say "no location" and store
copy must NOT promise leave-by/location reminders. To ship geofencing natively you'd
add `@capgo/background-geolocation` + `native/patch-geofence.js` to
`android-release.yml` and clear Play's background-location review (disclosure + form +
demo video). Deferred.

## App content declarations
- **Privacy policy:** https://nudgelive.co.uk/privacy
- **App access:** restricted (sign-in). Provide the demo account (below). Note Google
  sign-in is also available.
- **Ads:** No (no ad SDKs).
- **Content rating (IARC):** category Utility/Productivity; No to violence, sexuality,
  profanity, controlled substances, gambling; users share content only within a
  private family group (no public/social, no stranger contact); no user location
  shared. → PEGI 3 / Everyone.
- **Target audience:** 18+ (or 13+); do NOT include under-13. Appeals to children: No.
- **News / COVID / Government / Financial features / Health:** No to all (bills are
  reminders only — no banking/payments/health functions).

## Data safety (full)
- Collects user data: **Yes**. Encrypted in transit: **Yes** (HTTPS/TLS). Deletion:
  **Yes** — in-app (Profile → Delete account) + email `hello@nudgelive.co.uk`.
- Data types — all *collected*, server-processed, **not shared** for third-party use,
  linked to user, **not** used for tracking/ads, purpose = App functionality / Account:
  - Personal info → **Name**, **Email address**
  - **Photos and videos** (photo captures)
  - Audio → **Voice or sound recordings** (voice notes)
  - **Files & docs / other user content** (captured text, forwarded emails, tasks, lists)
  - Messages → **Other in-app messages** — *only if the WhatsApp/email-in inbound
    feature stays enabled*
  - Device or other IDs → **Push token (FCM)**
  - **Location: NOT collected** (see decision above)
  - Financial info → **Purchase history: set to Yes once the RevenueCat purchase flow
    is live** (not collected before billing ships)
- Processors (disclosed in `/privacy`, `/data-safety`): Groq, Resend, FCM/Google,
  Render, Turso, Google Sign-in, and — when live — RevenueCat + Google Play Billing.
  Meta/WhatsApp only if the forwarding feature stays on.

## Subscriptions (Monetize → Products → Subscriptions)
One subscription `nudge_pro`, two base plans, each with a 7-day free-trial offer:
- `monthly` — auto-renewing — **£3.49 / month**
- `annual`  — auto-renewing — **£29.99 / year**

RevenueCat: connect Play (service-account JSON) → import products → entitlement
**`pro`** with both products → one **Offering** (app shows annual first, "Best value")
→ Webhook to `https://nudgelive.co.uk/api/revenuecat/webhook` with the Authorization
header == `REVENUECAT_WEBHOOK_AUTH` (also set on Render). Set
`NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` (publishable Android key) in the build env.
Add yourself as a **license tester** to buy without being charged and verify the
purchase → webhook → `plan=pro` loop.

## Demo / review account
**No terminal needed:** log in as the admin (`ADMIN_EMAIL`) → **/admin → "Play-review
demo account" → Create / refresh demo account**. It prints the email + password to
paste into Play Console → App access. Defaults `reviewer@nudgelive.co.uk` /
`NudgeDemo2026!`; both overridable in the form. Comped to Pro, 5 sample tasks seeded,
idempotent. (CLI equivalent: `npx tsx scripts/seed-demo.ts` with optional
`DEMO_EMAIL`/`DEMO_PASSWORD` — but DB scripts can't run from the Claude container.)
Logic shared in `lib/demo.ts` (`seedDemoAccount`).

## Assets
Icon `public/icon-512.png` · Feature graphic `public/marketing/feature-graphic.png`
· Screenshots `public/screenshots/*.png` (leaf-branded mockups) · all regenerable
(`scripts/gen-*.ts`).

## Build & roll out
1. `git tag v1.0.0 && git push --tags` → `android-release.yml` builds signed `nudge.aab`.
2. Upload to **Internal testing** first (instant), confirm install + login.
3. Set up subscriptions + RevenueCat, test the purchase loop with a license tester.
4. Internal → Closed/Open → Production (first prod review can take a few days).
A subscription/release is not "done" until billing is verified end to end.
