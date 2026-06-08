# nudge — project memory

Durable context for future sessions. Keep this short and true; link out for detail.

## What it is
**nudge** (always lowercase) — a capture-first reminder / life-admin app. Capture
anything (text, photo, voice, forwarded email), AI pulls out the tasks, gentle
reminders fire in time. Next.js 15 App Router + TypeScript, Turso/libSQL, Groq
(extraction/vision/whisper), Resend (email in+out), web-push/VAPID + FCM, Capacitor
Android (remote WebView, `server.url = https://nudgelive.co.uk`), hosted on Render
(deploys from `main`). App ID `uk.co.nudgelive.app`. Tagline: **"Small nudges. Better outcomes."**

## Brand (Brand Guidelines v1.0 — the leaf mark)
- **Logo:** green leaf / speech-bubble outline holding an "n" + amber "nudge" dot.
  Navy "n" on light surfaces, cream "n" on dark. Single source of truth:
  `scripts/gen-brand.ts` → `assets/*` → `public/*` (icons), `app/LogoMark.tsx` (in-app).
- **Colours:** Green `#7BAA94` · Navy `#232A32` · Amber `#F5B52E` (hover `#E0A527`)
  · Mint `#CFE0D5` · Dark Navy `#161B21` · Cream `#ECE6D6` · BG `#F8F7F4` · Muted `#667085`.
  Ratios Navy 60 / White 20 / Green 15 / Amber 5.
- **Typeface:** Inter (app, emails, generated assets).
- Regenerate assets: `npx tsx scripts/gen-brand.ts && npx tsx scripts/gen-icons.ts`;
  social `gen-social.ts`; landing screenshots `gen-screenshots.ts`.

## Pricing / monetization
- **Free** (forever): 10 AI captures/month + in-app reminders (`FREE_MONTHLY_CAPTURES`).
- **Pro:** £3.49/month or £29.99/year, **7-day free trial** on both.
- Billing = **RevenueCat** over **Google Play Billing** (digital goods must use Play
  Billing in the Android app). Entitlement id `pro`. Server is billing-agnostic:
  `lib/plan.ts` `setPlan()`; `/api/revenuecat/webhook` maps RC `app_user_id` → our
  `user.id` and flips `plan`. In-app purchase UI: `app/PurchasePro.tsx` (native only,
  via the Capacitor bridge global — not bundled into the web build).
- Env: `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` (publishable, build-time),
  `REVENUECAT_WEBHOOK_AUTH` (Render), `REVENUECAT_ENTITLEMENT` (default `pro`).
- Also: promo codes + admin comps (`lib/plan.ts`), pre-launch waitlist
  (`lib/interest.ts`, "first 10 free for life") shown while `REGISTRATION_OPEN!=true`.

## Privacy / data (kept TRUE — Play Data Safety depends on it)
- Raw captures purged after `RAW_RETENTION_DAYS` (30) — `purgeExpiredRawCaptures()`
  runs each dispatch cron tick. Account deletion (`lib/account.ts`) removes ALL
  user rows incl. `places` (geofence lat/lng), `fcm_tokens`, `lists`, `promo_redemptions`.
- **Location is NOT in the Play release build** (only the debug `android.yml` adds the
  geofence plugin; `android-release.yml` does not). So geofencing/leave-by is web/PWA
  only. Don't claim it in store copy or Data Safety until shipped natively (background
  location = hard Play review).
- Public pages: `/privacy`, `/terms`, `/data-safety` (the Data Safety answer key).

## Conventions
- **Keep these docs current — every turn.** After each exchange that establishes a
  decision, changes a fact, or ships code, update the relevant doc (`CLAUDE.md` and/or
  `PLAY_STORE.md`/`STORE_LISTING.md`/`SPEC.md`) and commit it with the work. Standing
  instruction from the user. Skip only when a message changes nothing durable.
- **Git:** develop on `claude/new-session-d52qs`. Workflow: commit → `git push -u
  origin <branch>` → `git checkout main && git reset --hard origin/main && git merge
  --no-ff <branch> && git push origin main`. `origin/main` is the source of truth (the
  container/proxy has served stale snapshots before — always reset from origin/main).
  Identity: `Claude <noreply@anthropic.com>`. Don't include the model id in commits.
- **Schema:** self-healing — `lib/schema.sql` + additive ALTERs in `lib/db.ts`.
- **Android builds:** GitHub Actions. `android.yml` = debug APK (incl. geofencing);
  `android-release.yml` = signed AAB+APK on a `v*` tag (Play build, no geofencing).
  `npx cap add android` regenerates native; native code injected via `native/patch-*.js`.
- **resvg has no Inter/emoji font** → generated cover PNGs render a fallback sans and
  must be emoji-free; animated SVGs keep emoji (recorded on-device).

## Doc index
- `SPEC.md` — product/architecture spec.       - `PLAY_STORE.md` — Play submission answer key.
- `STORE_LISTING.md` — marketing copy/scripts.  - `DEPLOY.md` — deploy/runbook.
- `CAPACITOR.md` — native build.  - `WHATSAPP.md` · `LOCATION.md` · `SOCIAL_CALENDAR.md`.
