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

## Notes & later phases

- **Cron jobs** for reminders + the daily digest (Phase 2) are defined but
  commented out at the bottom of `render.yaml`. Uncomment them once
  `scripts/dispatch.ts` and `scripts/digest-run.ts` exist, and copy the Turso
  secret env vars onto each job.
- **Free plan** web services sleep after inactivity; fine for trialling, but
  the reminder dispatcher cron needs a paid plan (or an external pinger) to be
  reliable. Revisit at Phase 2.
- **Custom domain / branding** is deferred (SPEC top matter); the wordmark is
  driven by the optional `APP_NAME` env var.
