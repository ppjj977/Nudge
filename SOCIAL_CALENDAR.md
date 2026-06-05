# Nudge — 30-Day Launch Social Calendar (TikTok + Facebook)

A drop-a-day plan to run **before and through** the Google Play launch while
sign-up is closed and the goal is **register-interest sign-ups**.

## The campaign in one line

> Nudge turns the messy stuff — screenshots, school letters, voice notes,
> forwarded emails — into reminders before things slip. Capture-first, no
> productivity theatre.

## The launch promo (the hook for every post)

- **First 10 to register interest → Nudge Pro free for life.** 🎁
- After the first 10 → **3 months of Pro free** at launch for anyone who
  registers interest.
- Single CTA everywhere: **register your interest at nudgelive.co.uk**
  (the homepage CTA + footer already point to `/register-interest`).

**How to honour it mechanically (already built):**
- The waitlist records join order (`interest_signups.position`). The first 10
  are flagged 🎁 in **/admin**.
- When you open sign-up, create a promo code in /admin — e.g.
  `FOUNDERS` with **Days = blank (forever)** and **Max uses = 10** — and email
  it to positions #1–#10. For the wider cohort create `EARLY90` with
  **Days = 90**, no max. Codes are redeemed at `/upgrade` once they have an account.

## Assets you already have (drop these straight in)

| Asset | Path | Use for |
|---|---|---|
| Animated walkthrough | `public/demo-walkthrough.svg` | Screen-record it for a TikTok; export frames for FB carousels |
| Interactive demo | `DemoPlayer` on the homepage | Screen-record the hero on a phone for a "watch it sort this" clip |
| Timeline screenshot | `public/screenshots/timeline.png` | Hero shot, "your day at a glance" |
| Calendar screenshot | `public/screenshots/calendar.png` | Multi-day plans / holidays posts |
| Family screenshots | `public/screenshots/family-tab.png`, `family.png` | Shared-list / household posts |
| Review tray screenshot | `public/screenshots/review.png` | "It never guesses silently" trust posts |
| Feature graphic | `public/marketing/feature-graphic.png` | FB header / event cover |
| Promo graphic | `public/marketing/promo.png` | Promo/countdown posts |

**Recording tip:** most TikToks below are a 1-tap screen recording of a real
capture flow on the phone. Film the messy input (a school letter / a bill /
a voice note) → the tasks appearing → a reminder firing. 9–15s is plenty.

## Posting cadence

- **TikTok:** daily, 7–15s, vertical 9:16, trending audio, big on-screen captions.
- **Facebook:** ~4×/week (the 🅵-marked days), mix of carousels, short native
  video (re-use the TikTok), and text + single image.
- Every post ends with the same CTA + link and 3–5 hashtags.
- Core hashtags: `#lifeadmin #adhd #adhdtok #mentalload #momlife #organised #reminders #productivity`

---

## Week 1 — Tease the problem & the promo (build the list)

**Day 1 — TikTok + 🅵**
- Hook: "POV: the school letter that's been in your bag for 3 days."
- Show: photo of a crumpled letter → Nudge pulls out "Bring PE kit Friday" + "Pay £15 trip by 15 June".
- **Assets (ready):**
  - 🎬 `public/social/day01-school-letter.svg` — animated 9:16 clip (loops every 14s). Open full-screen on a phone and **screen-record it** → that's your TikTok/Reel.
  - 🖼️ `public/social/day01-cover.png` — static 1080×1920 for the Facebook single-image post / TikTok cover.
- CTA: "First 10 to register interest get it FREE for life. Link in bio."
- Caption (paste): *"Me: I'll remember that. The letter: gone for 3 days. Nudge: 🫡 sorted. Snap the mess → it pulls out the dates, times & payments. 🎁 First 10 to register interest get Pro free for life → nudgelive.co.uk #lifeadmin #adhdtok #mentalload #momlife #schoolrun"*

**Day 2 — TikTok**
- Hook: "Things my brain refuses to remember 🧠❌" (rapid list: bin day, the dentist, the birthday, the bill).
- End on Nudge timeline screenshot. "Now I just send Nudge the mess."

**Day 3 — TikTok + 🅵**
- Hook: "Screenshot graveyard 📵" — scroll a camera roll full of screenshots.
- Punchline: "Nudge actually reads them and reminds you." Show `review.png`.
- FB version: carousel of 3 screenshots (screenshot → extracted task → reminder).

**Day 4 — TikTok**
- Hook: "The mental load is invisible until you write it ALL down."
- Show timeline filling up. Soft, relatable tone. Trending sad-to-relieved audio.

**Day 5 — TikTok + 🅵**
- Promo spotlight: "We're opening Nudge soon. First 10 on the waitlist = Pro free for LIFE."
- Asset: `promo.png` with a "X spots left" caption (update the number from /admin).

**Day 6 — TikTok**
- Hook: "Forward your chaos to a robot, challenge." Forward a confirmation email → task appears.

**Day 7 — TikTok + 🅵**
- Week-1 recap / social proof: "X people joined the waitlist this week." Re-share best comment.
- FB: text post asking "What's the ONE thing you always forget?" (engagement bait, seeds future content).

---

## Week 2 — Show the magic (capture methods)

**Day 8 — TikTok + 🅵** — "Snap a bill 📸": photo of a bill → "Pay water bill £42.18 by 28 June."
**Day 9 — TikTok** — "Voice note while driving 🎙️": speak "remind me to book the car in next Tuesday" → task.
**Day 10 — TikTok + 🅵** — "Type it like a human": "dentist tues half 9" → "Attend dentist — Tuesday 9:30". Show it's not rigid.
**Day 11 — TikTok** — "It asks instead of guessing": low-confidence item lands in review tray (`review.png`). Trust angle.
**Day 12 — TikTok + 🅵** — "A day in my Nudge" GRWM-style: morning digest → reminders through the day.
**Day 13 — TikTok** — Duet/stitch bait: "Tell me the most unhinged thing in your notes app, I'll Nudge it."
**Day 14 — TikTok + 🅵** — Promo check-in: "Only [N] free-for-life spots left." Countdown urgency. `promo.png`.

---

## Week 3 — Who it's for + family (widen the net)

**Day 15 — TikTok + 🅵** — "If you have ADHD, this is your external brain." Lean into `#adhdtok`. External-brain framing.
**Day 16 — TikTok** — "Parents: the term-time admin avalanche." School letters, trips, non-uniform days.
**Day 17 — TikTok + 🅵** — Family share: shared shopping/packing list updates live across the house (`family-tab.png`).
**Day 18 — TikTok** — "Couple who never knows whose turn it is" — assign a shared task to a partner.
**Day 19 — TikTok + 🅵** — Holiday/trip planning: multi-day plan on the calendar (`calendar.png`).
**Day 20 — TikTok** — "Birthdays you forget every year 🎂": recurring celebrate reminder.
**Day 21 — TikTok + 🅵** — Testimonial/UGC: re-post an early tester quote (or stage a "my wife with ADHD tried it" story).

---

## Week 4 — Launch run-up (convert the list)

**Day 22 — TikTok + 🅵** — "Nudge hits Google Play in [X] days." Build hype. `feature-graphic.png`.
**Day 23 — TikTok** — "What makes Nudge different": no feeds, no streaks, no guilt. Anti-productivity-theatre manifesto.
**Day 24 — TikTok + 🅵** — Behind the scenes / founder: why I built it (the real life-admin story). Authentic, face-to-camera.
**Day 25 — TikTok** — "Last chance for free-for-life" if any of the 10 spots remain; else "3 months free for everyone who joins now."
**Day 26 — TikTok + 🅵** — Feature montage set to trending audio: capture → extract → review → remind. Fast cuts.
**Day 27 — TikTok** — FAQ in 15s: "Is it free? Is my data safe? Does it work for ADHD?" Point to `/faq` + `/privacy`.
**Day 28 — TikTok + 🅵** — "We're LIVE on Google Play 🎉" (or "T-minus 2 days"). Pin it. Repurpose as FB event.
**Day 29 — TikTok** — Onboarding tip for new users: "First thing to capture? The thing nagging you right now."
**Day 30 — TikTok + 🅵** — Thank-you + momentum: "[N] people joined. Pro promo for waitlisters ends [date]." Final CTA.

---

## Reusable caption templates

**Problem/relatable:**
> Me: I'll definitely remember that.
> The thing: *gone from my brain in 4 seconds.*
> Nudge: 🫡 sorted.
> 🎁 First 10 to register interest get Pro free for life → nudgelive.co.uk
> #lifeadmin #adhdtok #mentalload

**Feature/demo:**
> Watch Nudge turn [a bill / a school letter / a voice note] into a reminder before it slips.
> No typing it out twice. No app that nags you. Just one less thing to hold in your head.
> Register your interest (sign-up's not open yet) → nudgelive.co.uk
> #reminders #productivity #organised

**Promo/urgency:**
> ⏳ [N] free-for-life spots left.
> Nudge Pro, free forever, for the first 10 people on the waitlist.
> After that: 3 months free at launch.
> Link in bio 👆 #nudge #lifeadmin #adhd

## Notes for whoever runs this

- Keep the **/admin waitlist** open while posting so you can quote a live spot
  count and total sign-ups in promo posts.
- Re-record the homepage `DemoPlayer` on a real phone for the most authentic
  TikTok B-roll; the `demo-walkthrough.svg` is the polished fallback.
- Swap real numbers into every "[N]" before posting.
- Don't promise an exact launch date until Play review clears — use "soon" /
  "[X] days" and update once you have a hard date.
