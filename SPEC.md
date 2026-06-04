# SPEC.md — Life Admin Capture App

**Working codename:** `relay` (placeholder, branding deliberately deferred — do not bake a brand name into code, use the codename or a config value)
**Owner:** Adam
**Status:** v1 scope, ready to build
**Audience for this doc:** Claude Code

---

## 1. What we are building

A capture-first life admin assistant. The user forwards or pastes information they already receive (emails, screenshots, newsletters, message exports, PDFs), and the app extracts the actionable parts into a single timeline of tasks with reminders, plus a daily digest.

The core promise is the inversion of a normal to-do app: **the user never enters tasks manually. The app creates them from information the user already gets.** Manual entry is a fallback, not the primary flow.

### The data flow, end to end

```
Capture (email / paste / image)
   -> Normalize to plain text (OCR or vision for images)
   -> Extract structured items via Groq (forced JSON schema)
   -> Write tasks to Turso (high-confidence -> timeline, low-confidence -> review tray)
   -> Generate reminders per category rules
   -> Cron dispatches reminders + daily digest
```

The **extraction schema (section 7) is the spine.** Everything upstream feeds it; everything downstream reads it. Build it first.

---

## 2. Scope

### In scope (v1)

- Three capture methods: email forwarding, copy/paste text, image/screenshot upload.
- Normalization of all inputs to plain text before extraction (one extraction path, not three).
- LLM extraction into a fixed set of action-type categories with per-category fields.
- A unified timeline (Today / This week / Later) and a review tray for low-confidence items.
- Per-category reminder generation and dispatch.
- A daily email digest.
- Minimal account system and a simple web dashboard.

### Explicitly out of scope (do NOT build in v1)

- Native mobile apps or a mobile share-sheet target. (This is the most important activation feature long term, but it is phase 3+, not now.)
- Direct integrations with WhatsApp, Slack, Teams, or any messaging API. These are walled gardens. The supported path for those sources in v1 is screenshot or pasted export, nothing more. Do not attempt to automate message ingestion.
- Vertical-specific extraction rules (for example, knowing that a "non-uniform day" implies a kit reminder). v1 uses general categories only; the task title carries the detail.
- Calendar two-way sync. (An `.ics` export for single events is a stretch goal, see phase 4.)
- Any CRM backend, Workbooks, or B2B/organisation features. Single individual user only.
- Payments / billing for the product itself.

### Future phases (context only, do not build)

- Mobile capture, push notifications, B2B2C org accounts, smarter vertical extraction, calendar sync.

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Database | Turso (libSQL / SQLite) | Single-user task state. Access via `@libsql/client`. |
| Hosting | Render | One web service plus Render Cron Jobs. |
| Scheduling | Render Cron Jobs | Reminder dispatcher and daily digest. Inbound email is event-driven, not cron. |
| LLM | Groq | Extraction and image-to-text. Model is a config value, see below. |
| Source control | GitHub | |
| Language / framework | TypeScript + Next.js | Single deploy for API routes and the dashboard. Swappable, but pick one and commit. |

Render and Cloudflare are not on the bash allowlist for this environment, so deployment is the user's manual step. Build and test locally against a local libSQL file and a Turso dev database.

### Groq model

Do **not** hardcode a model string. Put it in `GROQ_MODEL` env var. Adam will set it from Groq's current catalogue at build time, because the available models change frequently. Assume two roles:

- A text extraction model (a capable instruction-following model, the larger/"versatile" tier).
- An image-to-text path. Prefer a vision-capable Groq model if one is available; otherwise fall back to local OCR (Tesseract) producing text, then the normal text extraction model. See open decisions, section 13.

---

## 4. Architecture / components

1. **Web app + API (Next.js on Render).** Serves the dashboard and the ingest/task endpoints.
2. **Ingestion webhook.** Receives inbound forwarded email from the mail provider and posts it into the pipeline.
3. **Extraction service.** A module (not a separate deploy) that takes normalized text plus context (today's date, user timezone) and calls Groq with the forced-JSON contract.
4. **Reminder dispatcher (Render Cron Job).** Runs frequently (every 15 minutes), finds reminders whose `fire_at` has passed and are still pending, sends them, marks them sent.
5. **Daily digest job (Render Cron Job).** Runs hourly, sends the morning digest to any user whose local time has just reached their digest hour.
6. **Turso.** All persistent state.

---

## 5. Data model (Turso)

Use these tables. IDs are text (use a collision-resistant id like a ULID or nanoid). Store timestamps as ISO 8601 UTC strings. JSON columns hold loosely structured extras.

### `users`
| column | type | notes |
|---|---|---|
| id | text PK | |
| email | text unique | |
| timezone | text | IANA, e.g. `Europe/London`. Needed for reminders and digest timing. |
| inbound_address | text unique | the unique forwarding address for this user |
| digest_hour | int | local hour to send digest, default 7 |
| settings | text (json) | reminder offset overrides, retention prefs |
| created_at | text | |

### `captures`
Raw inbound, kept for audit and reprocessing.
| column | type | notes |
|---|---|---|
| id | text PK | |
| user_id | text FK | |
| source | text | `email` \| `text` \| `image` |
| raw_content | text | original payload (or pointer to stored image) |
| normalized_text | text | text fed to the extractor |
| received_at | text | |
| status | text | `pending` \| `processed` \| `failed` |
| meta | text (json) | sender, subject, ocr confidence, etc |

### `tasks`
| column | type | notes |
|---|---|---|
| id | text PK | |
| user_id | text FK | |
| capture_id | text FK | source of this task |
| category | text | one of the 7 action types or `fyi` (section 7) |
| title | text | verb + object + qualifier, short |
| detail | text | optional short context |
| due_at | text null | ISO 8601, when due or when it happens |
| due_type | text | `datetime` \| `date` \| `none` |
| amount | real null | for `pay` |
| currency | text null | for `pay`, default `GBP` |
| location | text null | for `attend` / `book` |
| life_area | text null | `school` \| `home` \| `work` \| `money` \| `health` \| `personal` \| `other` |
| status | text | `review` \| `active` \| `done` \| `paid` \| `dismissed` |
| confidence | real | 0.0 to 1.0 |
| source_excerpt | text | short quote justifying the task |
| created_at | text | |
| updated_at | text | |
| completed_at | text null | |

### `reminders`
Generated from a task plus its category offset rules.
| column | type | notes |
|---|---|---|
| id | text PK | |
| task_id | text FK | |
| user_id | text FK | denormalized for dispatcher queries |
| fire_at | text | ISO 8601 UTC |
| channel | text | `email` for v1 |
| status | text | `pending` \| `sent` \| `cancelled` |
| sent_at | text null | |

When a task is completed, paid, or dismissed, cancel its pending reminders. When `due_at` is edited, regenerate reminders.

### `digest_log` (optional but recommended)
Records when a digest was last sent per user, so the hourly job does not double-send.

### Privacy / retention

This is a trust feature, not a nicety. Add a retention setting: purge `captures.raw_content` after N days (default 30) while keeping the derived task. Make this configurable per user. The marketing angle for this product will be "we do not hoard your mail," so build the mechanism in from the start.

---

## 6. Capture flows

All three normalize to plain text, then hit the same extraction path.

1. **Email forwarding.** Each user gets a unique `inbound_address`. The mail provider routes inbound mail to a webhook (`POST /api/ingest/email`). Match the recipient address to a user, store a `capture`, normalize the body to text (strip signatures and quoted reply chains where cheaply possible), then extract.
2. **Paste text.** `POST /api/ingest/text` with `{ text }`. Store capture, extract.
3. **Image / screenshot.** `POST /api/ingest/image` with the file. Convert to text (vision model or OCR), store capture with the text in `normalized_text`, extract.

---

## 7. Extraction layer (the spine)

### Categories

Primary axis is **action type**, not life area. Life area is a secondary tag only. Seven action categories plus an `fyi` escape hatch.

| category | meaning | drives | key fields |
|---|---|---|---|
| `pay` | money out by a date | mark-paid state, amount tracking | amount, currency, due_at |
| `book` | arrange a slot or appointment | may spawn an `attend` task once booked | due_at (deadline to book by), location |
| `attend` | be somewhere at a set time | calendar-style reminder, `.ics` later | due_at (datetime), location |
| `prepare` | have something ready / bring something on a day | evening-before + morning-of reminders | due_at (the day) |
| `send` | deliver or reply to someone | | due_at |
| `renew` | recurring deadline before something lapses or auto-charges | ahead-of-time warning | due_at |
| `reminder` | catch-all time-based nudge, no clean verb | | due_at |
| `fyi` | informational, no action, no due date | no reminders, shown muted | — |

Do not exceed these. More categories means more misclassification.

### Title convention

The model writes the title as the thing the user would actually do: verb + object + short qualifier. Examples: `Pay school trip (£15)`, `Bring PE kit`, `Book boiler service`, `Send proposal`, `Renew car insurance`. Not a summary of the email.

### The hard rules

1. **The model may extract nothing.** If the input asks nothing of the user (a pure newsletter), return zero items with `nothing_actionable: true`. Do not invent tasks. This is the most common failure mode and the fastest way to lose trust.
2. **Every item gets a `confidence` (0 to 1).** Items below a threshold (start at 0.6, make it config) land with `status: review` in the review tray, not silently in the timeline.
3. **Every item carries a `source_excerpt`** (a short quote from the input) so the user can see why it exists.
4. **Resolve relative dates** ("next Friday", "the 15th") against the supplied current date and the user timezone. If a date cannot be resolved, set `due_type: none` rather than guessing.

### Output contract

The Groq call must return ONLY this JSON, no prose, no markdown fences. Strip fences defensively before parsing and validate against the schema; on parse failure, mark the capture `failed` and log, do not crash.

```json
{
  "nothing_actionable": false,
  "items": [
    {
      "category": "pay",
      "title": "Pay school trip (£15)",
      "detail": "Year 4 trip to the museum",
      "due_at": "2026-06-15",
      "due_type": "date",
      "amount": 15,
      "currency": "GBP",
      "location": null,
      "life_area": "school",
      "confidence": 0.93,
      "source_excerpt": "School trip payment of £15 due by the 15th"
    }
  ]
}
```

The system prompt must: state today's date and the user timezone, define each category, give the title convention, enforce the "extract nothing is valid" rule, demand the JSON shape exactly, and instruct that `due_at` is null when `due_type` is `none`.

---

## 8. Reminder rules

Defaults below. Store as config so they can be tuned without code changes. All times resolved in the user's timezone, then stored as UTC `fire_at`.

| category | reminders fired |
|---|---|
| `pay` | 3 days before due, 1 day before, and on the due date if still unpaid |
| `book` | on capture if deadline is far, then 1 week before, then 2 days before |
| `attend` | 1 day before, and 2 hours before the start time |
| `prepare` | evening before (18:00 local) and morning of (07:00 local) |
| `send` | 1 day before and on the due date |
| `renew` | 2 weeks before and 3 days before |
| `reminder` | at `due_at` (or shortly before) |
| `fyi` | none |

Skip any reminder whose computed `fire_at` is in the past at creation time.

---

## 9. Daily digest

- Hourly Render Cron Job. For each user whose local time has reached `digest_hour` and who has not had a digest today, compose and send.
- Sections: **Today** (tasks due today plus any overdue), **This week** (due within 7 days), and a short **Needs review** line if the review tray is non-empty.
- Plain, scannable email. Each line is the task title plus due context. Keep it short; the digest competes with the inbox it is trying to rescue the user from.

---

## 10. API endpoints

| method | path | purpose |
|---|---|---|
| POST | `/api/ingest/email` | inbound mail webhook |
| POST | `/api/ingest/text` | paste capture |
| POST | `/api/ingest/image` | image/screenshot capture |
| GET | `/api/tasks` | timeline, grouped today / this week / later, plus review tray |
| PATCH | `/api/tasks/:id` | edit, mark done/paid, snooze, reschedule (regenerates reminders) |
| POST | `/api/tasks/:id/confirm` | promote a review-tray item to active |
| DELETE | `/api/tasks/:id` | dismiss/delete (cancels reminders) |
| POST | `/api/auth/request` | request a magic link (body: email) |
| GET | `/api/auth/callback` | consume the signed token, create the session |
| POST | `/api/auth/logout` | clear the session |

---

## 10a. Authentication (decided)

**v1 is passwordless magic link, keyed on email. No password, no Google sign-in in v1.**

Rationale: the user hands over a verified email the moment they set up forwarding, so a password is a second credential to store, hash, and reset for no gain, and an OAuth consent screen adds friction for the less technical end of the audience.

Flow:
1. User enters their email. `POST /api/auth/request` issues a single-use, time-limited signed token (15 minute expiry) and emails the link via the transactional sender (section 13).
2. `GET /api/auth/callback?token=...` validates the token, marks it used, and creates a long-lived session (target 30 to 90 days) so repeat logins are rare. First successful login creates the `users` row and provisions the unique `inbound_address`.
3. Sessions are server-side or signed httpOnly cookies. Tokens are single-use and invalidated on consumption.

**Google sign-in is a planned fast follow, not v1.** Add it only if signup conversion turns out to be the bottleneck. It also carries a perceived-legitimacy benefit at signup that may justify pulling it forward once there is a brand to attach to it.

---

## 11. Build phases

Build in this order. Each phase should be independently testable.

**Phase 1 — core pipeline (prove extraction quality).**
Paste and image capture, normalization, extraction into tasks, the timeline view, and the review tray. No email-in, no reminders, no digest yet. Goal: confirm the model extracts cleanly and the "extract nothing" and confidence rules behave. Test against a folder of real-world sample inputs (school newsletters, bills, meeting notes, a wedding-group screenshot).

**Phase 2 — reminders + digest.**
Reminder generation per category, the dispatcher cron, and the daily email digest.

**Phase 3 — email forwarding.**
Inbound mail provider, unique per-user addresses, the webhook ingest path.

**Phase 4 — trust + polish.**
Confidence tuning, snooze/reschedule, retention controls, and `.ics` export for `attend` tasks.

---

## 12. v1 acceptance criteria

- A user can paste a school newsletter and get the correct discrete tasks, with no invented tasks from the informational parts.
- An image of a bill or letter produces a `pay` task with amount and due date.
- Low-confidence extractions appear in the review tray, not the live timeline.
- Each task generates the correct reminders for its category, and they fire at the right local times.
- A daily digest arrives at the user's chosen hour with Today and This week populated correctly.
- Forwarding an email to the user's unique address creates tasks.
- Completing or dismissing a task cancels its reminders.
- Raw capture content is purged per the retention setting.

---

## 13. Open decisions (resolve before or during the relevant phase)

1. **Inbound email provider (phase 3).** Options: Cloudflare Email Routing forwarding to a worker that posts to the app (cheapest), or Mailgun / Postmark inbound parse (simpler, paid). Recommendation: Cloudflare Email Routing for the MVP. Decide before phase 3, not now.
2. **Image to text (phase 1).** Vision-capable Groq model vs local Tesseract OCR. Recommendation: try a Groq vision model first for quality; keep Tesseract as a fallback. Both must output into `normalized_text` so the extraction path is identical.
3. **Groq model string.** Set `GROQ_MODEL` from the current Groq catalogue at build time. Do not hardcode.
4. **Outbound email (reminders + digest).** Pick a transactional sender (e.g. Resend, Postmark). Config via env vars. Note: this also sends the magic-link auth emails, so it is needed from phase 1, not just for reminders.

(Auth is now decided, see section 10a: magic link for v1, Google as a fast follow.)

---

## 14. Repo + getting started (for Claude Code)

Suggested structure (Next.js app router):

```
/relay
  /app                 # dashboard pages + /api routes
  /lib
    db.ts              # libSQL client
    extract.ts         # Groq call + JSON contract + validation
    normalize.ts       # email/text/image -> plain text
    reminders.ts       # category offset rules -> reminder rows
    digest.ts          # digest composition
  /scripts
    dispatch.ts        # Render cron: send due reminders
    digest-run.ts      # Render cron: hourly digest
  /prompts
    extract.system.md  # the extraction system prompt
  /samples             # real-world test inputs for phase 1
  SPEC.md
  .env.example
```

`.env.example` keys: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GROQ_API_KEY`, `GROQ_MODEL`, mail-provider keys, outbound-email keys, `CONFIDENCE_THRESHOLD`, `RAW_RETENTION_DAYS`.

Start with phase 1, and start phase 1 with `/prompts/extract.system.md` and `lib/extract.ts` plus a handful of real sample inputs in `/samples`. Get extraction trustworthy before building anything around it.
