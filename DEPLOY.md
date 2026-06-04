# Deploying relay to Render

Render (and Cloudflare) are not reachable from the build environment, so this
is a manual step. Everything is pre-wired via [`render.yaml`](./render.yaml) —
the steps below are the one-time setup.

## 1. Provision a Turso database

Render's filesystem is ephemeral, so production must use a **remote** Turso
database, not a `file:` SQLite path.

```bash
# install the CLI once: https://docs.turso.tech/cli/installation
turso db create relay
turso db show relay --url            # -> TURSO_DATABASE_URL (libsql://…)
turso db tokens create relay         # -> TURSO_AUTH_TOKEN
```

## 2. Get Groq credentials

- Create an API key at the Groq console → `GROQ_API_KEY`.
- Pick a current text model from Groq's catalogue → `GROQ_MODEL`
  (do not hardcode; it changes often — SPEC §13).
- Optionally pick a vision model → `GROQ_VISION_MODEL` (else images use the
  bundled Tesseract OCR fallback).

## 3. Create the Render service from the blueprint

1. Push this repo to GitHub (done — it's on `main`).
2. In Render: **New → Blueprint**, then select this repository.
3. Render reads `render.yaml` and proposes the `relay-web` web service.
4. Fill in the secret env vars it prompts for (the ones marked `sync:false`):
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GROQ_API_KEY`, `GROQ_MODEL`,
   `GROQ_VISION_MODEL` (optional), and `DEFAULT_USER_EMAIL`.
5. **Apply.** Render runs `npm ci && npm run build`, then `npm run db:migrate`
   as the pre-deploy step (creates the tables), then starts the app.

The default user is provisioned lazily on the first request
(`getOrCreateDefaultUser`), so no separate seed step is needed in production.

## 4. Verify

- Open the service URL → the dashboard loads.
- Paste a sample (e.g. the contents of `samples/electricity-bill.txt`) →
  a `pay` task should appear with the amount and due date.

## Phase 2: reminders, digest & notifications

These are needed for nudge to actually nudge.

### a. Email (Resend)
1. Create an account at https://resend.com, add + verify a sending domain.
2. Create an API key → set `RESEND_API_KEY`.
3. Set `MAIL_FROM` to an address on your verified domain (e.g. `nudge@yourdomain`).

### b. Web push (app notifications)
1. Generate a VAPID keypair once:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
   (`mailto:you@yourdomain`).
3. In the app's **Settings**, click **Enable on this device** and allow
   notifications. (On iPhone, first Add to Home Screen — an Apple limitation.)

### c. Scheduler (free, via GitHub Actions)
The reminder dispatcher and digest run by pinging secured endpoints on a
schedule. The included workflow (`.github/workflows/cron.yml`) does this free:

1. Set `CRON_SECRET` (a long random string) and `APP_BASE_URL`
   (e.g. `https://nudge-s1mn.onrender.com`) in the **app's** Render env.
2. In **GitHub → repo → Settings → Secrets and variables → Actions**, add the
   same two as repository secrets: `CRON_SECRET` and `APP_BASE_URL`.
3. The workflow runs every ~15 min. Trigger it once manually from the **Actions**
   tab to confirm it returns `{"due":...}` / `{"considered":...}`.

Prefer not to use GitHub? Point any cron/uptime service at
`POST /api/cron/dispatch` and `/api/cron/digest` with header
`x-cron-secret: <CRON_SECRET>`, or uncomment the paid Render Cron Jobs in
`render.yaml`.

## Notes & later phases

- **Free plan** web services sleep after inactivity, which is why scheduling is
  done by pinging the app from outside (GitHub Actions, section c) rather than an
  in-process timer. The ping also wakes the service. Native Render Cron Jobs
  (paid) are available as commented entries in `render.yaml`.
- **Custom domain / branding** is deferred (SPEC top matter); the wordmark is
  driven by the optional `APP_NAME` env var.
