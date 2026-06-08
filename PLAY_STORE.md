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
  profanity, controlled substances, gambling; no user location shared. → PEGI 3 / Everyone.
  - *User-content-sharing branch (Nudge Family):* "Does the app allow users to
    interact/exchange content?" **Yes** (family task/list sharing — text only, no
    voice, no free-form messaging). Then: is shared UGC the primary content? **No** ·
    public nudity? **No** · public graphic violence? **No** · block users? **No** ·
    report users? **No** · chat moderation? **No** (no chat) · **interactions limited
    to invited friends only? Yes** (this is the safety control that keeps it Everyone).
  - *Online content:* "features/promotes content not in the download?" **Yes** —
    connected app (synced data) + generative AI (task extraction & step-breakdowns).
    Content surfaced is the user's own private input + AI summaries of it only (no
    public catalog/feed). Doesn't raise the rating.
  - *Miscellaneous:* shares precise location with other users? **No** · purchase
    digital goods? **Yes** (Pro subscription) · cash/gift-cards/play-to-earn/crypto/
    NFTs? **No** · web browser or search engine? **No** · primarily news/educational?
    **No**.
- **Generative AI** (App content section, separate from the rating): declare **Yes**.
  AI only transforms the user's own captures into their own tasks — no image gen, no
  open-ended chatbot, no public output.
- **Target audience:** 18+ (or 13+); do NOT include under-13. Appeals to children: No.
- **News / COVID / Government / Financial features / Health:** No to all (bills are
  reminders only — no banking/payments/health functions).

## Data safety (full)
- Collects user data: **Yes**. Encrypted in transit: **Yes** (HTTPS/TLS). Deletion:
  **Yes** — in-app (Profile → Delete account) + email `hello@nudgelive.co.uk`.
- **Delete account URL** (public, required by the form): `https://nudgelive.co.uk/delete-account`
  (page = `app/delete-account/page.tsx`). Optional "delete some data without deleting
  account": answer **No** (do NOT pick "auto-deleted within 90 days" — only raw
  captures auto-purge at 30 days; tasks persist until completed/deleted).
- Account creation methods (select all): **Username and password** (email+password),
  **Username and other authentication** (passwordless magic-link), **OAuth** (Google).
- Additional badges: none (no independent security review; not an India/UPI app).
- Data types (Step 3 checkboxes) — all *collected*, server-processed, **not shared**
  for third-party use, linked to user, **not** used for tracking/ads, purpose = App
  functionality / Account management:
  - Personal info → **Name**, **Email address** (not User IDs — internal id is generated)
  - Photos and videos → **Photos** (photo captures)
  - Audio files → **Voice or sound recordings** (voice notes)
  - Files and docs → **Files and docs** (forwarded-email content + attachments)
  - App activity → **Other user-generated content** (tasks, notes, lists)
  - Messages → **Emails** (email-in forwarded content); **+ Other in-app messages
    ONLY if WhatsApp capture is live in prod**
  - Device or other IDs → **Device or other IDs** (FCM/push token)
  - **Location: NOT collected** (see decision above)
  - Financial info → **Purchase history: tick once the RevenueCat purchase flow is
    live** (not collected before billing ships; a "£15" in a task is user content)
  - Leave empty: Health/fitness, Calendar (no device-calendar read), Contacts (invites
    typed manually), Web browsing, App info & performance (no analytics/crash SDK).
- Data usage & handling (Step 4) — same for every type: **Collected** (never Shared —
  Groq/Resend/FCM/Turso/Render are service providers, exempt from "shared"); **not**
  processed ephemerally (stored); purpose **App functionality** (+ **Account management**
  for Name & Email). Required vs optional: **Email = required**; everything else =
  **optional** (user chooses to add a photo/voice/email-in/task or enable notifications).
  App activity should be **only "Other user-generated content"** (no analytics → no App
  interactions/Other actions).
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
