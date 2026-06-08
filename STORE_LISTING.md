# nudge — Play Store listing & marketing copy

Brand voice: calm, plain-spoken, anti-overwhelm. No hype, no "productivity
theatre". Lower-case "nudge". Don't over-promise the AI — say "pulls out / reads".

---

## App title (Play, ≤30 chars)
`nudge: capture & remind` (23)
Alternatives: `nudge — life admin, sorted` (26) · `nudge: your life-admin net` (26)

## Short description (Play, ≤80 chars)
`Forward the chaos — emails, photos, voice notes. nudge turns it into reminders.` (79)
Alt: `Send nudge the messy stuff. It finds the tasks and reminds you in time.` (70)

## Full description (Play, ≤4000 chars)

Life admin doesn't arrive as a tidy to-do list. It comes as a school newsletter,
a screenshot of an appointment, a bill, a voice note to yourself at the school
gate. nudge is the safety net for all of it.

Send nudge the messy stuff — paste it, snap a photo, record a voice note, share
from any app, or forward an email to your private nudge address. nudge reads it,
pulls out what you actually need to DO, and puts it on a calm timeline with a
gentle reminder before it slips.

WHY NUDGE IS DIFFERENT
• Capture-first. You don't fill in forms — you dump the mess and nudge does the
  sorting. Type, photo, voice, share, or email-in.
• It reads the chaos. A newsletter becomes "Bring PE kit — Friday" and
  "Pay £15 trip — by 15 June". A photo of a letter becomes a dated task.
• You stay in control. Anything it's unsure about waits in a review tray — never
  silently assumed, never lost.
• Gentle, well-timed reminders. Nudges before things are due, plus an optional
  once-a-day digest. No noisy feeds, no badges screaming at you.

BUILT FOR REAL LIFE
• Recurring tasks — bins, council tax, medication, the weekly shop.
• Birthdays & anniversaries — with a heads-up in time to sort a card or gift.
• Trips & holidays — block whole days across the calendar.
• Money view — see what's going out and by when.
• A clean timeline: Today, This week, Later — and a calendar.

NUDGE FAMILY
Share a list or a task with the household and everyone gets the nudge. Shared
shopping and packing lists, assign who's doing what, and tick things off
together. The family owner manages who's in.

MADE TO BE TRUSTED
• Raw captures are temporary.
• Low-confidence guesses go to review, not your timeline.
• No social layer. No ads. No productivity guilt.

For parents juggling school admin, anyone drowning in life-admin, people with
ADHD who need a net rather than another rigid app, and serial screenshot-hoarders
who forget what they saved. Give nudge one messy thing and see what it catches.

## "What's new" (release notes — first release)
First release of nudge 🎉 Capture by text, photo, voice, share or email-in;
recurring tasks, birthdays, trips; shared family lists & tasks; a home-screen
widget; and gentle, on-time reminders.

---

## Taglines (pick per surface)
- a gentle nudge for everything that matters
- capture the chaos. nudge sorts it.
- send it the messy stuff. it pulls out what matters.
- the safety net for life admin.

---

## Social posts (launch)
1. (X / short) "Forgot the PE kit again? nudge is the app that reads your school
   newsletters, bills and screenshots and turns them into reminders before things
   slip. Out now on Android 👇 nudgelive.co.uk"
2. (longer / FB) "Life admin doesn't arrive as a neat to-do list — it's
   newsletters, photos of letters, half-remembered jobs. nudge lets you dump the
   mess (type it, snap it, forward the email) and it pulls out what you need to
   do, with a gentle reminder in time. Share with the family too. nudgelive.co.uk"
3. (feature spotlight) "📷 Snap a letter → nudge reads it → it's on your timeline
   with a reminder. That's the whole idea."

---

## 30–60s video / screen-recording script

Goal: show the capture→sorted magic in <45s. Screen-record the app (or the
homepage interactive demo) and read the voiceover. Keep it calm.

0:00–0:05  HOOK
  VO: "This is your life admin." (show a messy inbox / a school newsletter / a
  pile of screenshots)
  ON-SCREEN: "Messy in."

0:05–0:18  CAPTURE
  VO: "Send nudge the mess — paste it, snap a photo, record a voice note, or
  forward the email."
  SHOW: open nudge → paste the newsletter text → tap Capture (or share a photo).

0:18–0:30  IT SORTS
  VO: "nudge reads it and pulls out what you actually need to do."
  SHOW: the "Added 3 tasks — check them" card expands to: Bring PE kit (Fri),
  Pay £15 trip (by 15 Jun), Parents' evening (book).
  ON-SCREEN: "Sorted out."

0:30–0:40  REMINDED + FAMILY
  VO: "It reminds you in time — and the whole family can share the load."
  SHOW: a reminder notification; then a shared family list being ticked off.

0:40–0:45  CLOSE
  VO: "nudge. A gentle nudge for everything that matters."
  ON-SCREEN: logo + "nudgelive.co.uk" + 'Get it on Google Play'.

Storyboard frames (if making stills): 1) messy newsletter 2) capture screen
3) tasks revealed 4) reminder notification 5) family list 6) logo/CTA.

---

## Assets in this repo
- Feature graphic (1024×500): `public/marketing/feature-graphic.png`
- Social / OG card (1200×630): `public/marketing/promo.png`
- Animated walkthrough (looping SVG): `public/demo-walkthrough.svg`
- Interactive demo: live in the homepage hero (`app/DemoPlayer.tsx`)
- Phone screenshots: `public/screenshots/*.png` (timeline, calendar, review,
  family, family-tab) — usable directly as Play screenshots.
- App icon source: `assets/icon.svg` → `public/icon-512.png`

## Pricing
Free (10 AI captures/mo + in-app reminders) · **Pro £3.49/mo or £29.99/yr, 7-day
free trial** (unlimited captures, email reminders + digest, family, recurring).
See `PLAY_STORE.md` for the subscription product setup.

## Submission answers
Privacy policy (`/privacy`), Terms (`/terms`) and the **Data safety** answer key
(`/data-safety`) are all live. The full Play Console answer set — App content,
Data safety, subscription products, demo account, roll-out — is in **`PLAY_STORE.md`**.

> Note: leave-by/location reminders are NOT in the Play release build — don't add
> them to this copy until shipped natively (see `PLAY_STORE.md`).
