# relay (codename)

A capture-first life admin assistant. You forward or paste the information you
already receive — emails, screenshots, newsletters, message exports — and the
app extracts the actionable parts into a single timeline of tasks. You never
type tasks in; the app creates them from what you already get.

See [`SPEC.md`](./SPEC.md) for the full design. _Branding is deliberately
deferred — the codename `relay` is a placeholder._

## Status — Phase 1 (core pipeline)

This repo currently implements **Phase 1** from `SPEC.md §11`: prove extraction
quality. That means paste + image capture, normalization, LLM extraction into
tasks, the timeline, and the review tray.

Implemented:

- The extraction **spine** (`SPEC.md §7`): forced-JSON contract, fence-stripping,
  schema validation, the "extract nothing is valid" rule, per-item confidence,
  and `source_excerpt`. See [`prompts/extract.system.md`](./prompts/extract.system.md)
  and [`lib/extract.ts`](./lib/extract.ts).
- Normalization of text / email / image to plain text (`lib/normalize.ts`),
  with a Groq vision path and a local Tesseract OCR fallback.
- Capture endpoints: `POST /api/ingest/text`, `POST /api/ingest/image`.
- Tasks API: `GET /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`,
  `POST /api/tasks/:id/confirm`.
- A web dashboard: capture box, Today / This week / Later timeline, and the
  review tray for low-confidence items.
- Turso/libSQL schema and migrations (`lib/schema.sql`, `scripts/migrate.ts`).
- Sample inputs and an offline extraction harness for tuning prompt quality.

Deferred to later phases (per `SPEC.md §11`), with the data model already in
place: magic-link auth (`§10a`), reminders + digest (`§8`, `§9`, phase 2),
inbound email forwarding (`§6.1`, phase 3), retention purge + `.ics` (phase 4).

Phase 1 runs as a **single seeded user** (`DEFAULT_USER_EMAIL`) so extraction
can be proven before auth and email sending are wired up.

## Setup

Requires Node 20.12+ (uses the built-in env-file loader).

```bash
npm install
cp .env.example .env        # then fill in the values below
npm run db:migrate          # create tables in the configured DB
npm run db:seed             # provision the default phase-1 user
npm run dev                 # http://localhost:3000
```

### Required env

| var | what |
|---|---|
| `TURSO_DATABASE_URL` | `file:./relay.db` for local dev, or a `libsql://…` URL |
| `TURSO_AUTH_TOKEN` | only for a remote Turso db |
| `GROQ_API_KEY` | your Groq key |
| `GROQ_MODEL` | a current text model from Groq's catalogue (not hardcoded — `SPEC.md §13`) |
| `GROQ_VISION_MODEL` | _optional_ vision model for images; falls back to Tesseract OCR |
| `CONFIDENCE_THRESHOLD` | review-tray cutoff, default `0.6` |

## Proving extraction quality

The fastest feedback loop for tuning the prompt — runs over `/samples` and
prints what would be created, without writing to the DB:

```bash
npm run extract:sample                  # all samples
npm run extract:sample electricity-bill.txt   # one
```

The sample set deliberately includes a pure newsletter
(`pure-newsletter.txt`) that must return **nothing** — the most important
failure mode to guard against (`SPEC.md §7` rule 1).

## Tests

```bash
npm test        # vitest — parsing, normalization, timeline bucketing
npm run typecheck
```

The unit tests cover the pure logic (JSON contract validation, email quote/
signature stripping, timeline bucketing) and run without any network access or
API keys.

## Deployment

Render is the intended host (one web service + Cron Jobs for phase 2). A
[`render.yaml`](./render.yaml) blueprint is included; see [`DEPLOY.md`](./DEPLOY.md)
for the step-by-step setup (provision a remote Turso db, set the env vars,
deploy via Render → New → Blueprint). Render/Cloudflare are not reachable from
the build environment, so the deploy itself is a manual step (`SPEC.md §3`).
