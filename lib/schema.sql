-- relay schema (SPEC §5). Timestamps are ISO 8601 UTC strings. JSON columns
-- hold loosely structured extras. IDs are text (nanoid, see lib/ids.ts).
-- This file is the single source of truth; scripts/migrate.ts applies it.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/London', -- IANA
  inbound_address TEXT UNIQUE,                            -- per-user forwarding addr (phase 3)
  digest_hour     INTEGER NOT NULL DEFAULT 7,             -- local hour
  settings        TEXT,                                   -- json: reminder offsets, retention prefs
  created_at      TEXT NOT NULL
);

-- Raw inbound, kept for audit and reprocessing. raw_content is purged per
-- retention setting (SPEC §5 Privacy / retention) while the task survives.
CREATE TABLE IF NOT EXISTS captures (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  source          TEXT NOT NULL,            -- 'email' | 'text' | 'image'
  raw_content     TEXT,                     -- original payload (or pointer to stored image)
  normalized_text TEXT,                     -- text fed to the extractor
  received_at     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processed' | 'failed'
  meta            TEXT                      -- json: sender, subject, ocr confidence, ...
);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  capture_id     TEXT REFERENCES captures(id),
  category       TEXT NOT NULL,             -- 7 action types or 'fyi' (SPEC §7)
  title          TEXT NOT NULL,             -- verb + object + qualifier
  detail         TEXT,
  due_at         TEXT,                      -- ISO 8601, null when due_type='none'
  due_type       TEXT NOT NULL DEFAULT 'none', -- 'datetime' | 'date' | 'none'
  amount         REAL,                      -- for 'pay'
  currency       TEXT,                      -- for 'pay', default 'GBP'
  location       TEXT,                      -- for 'attend' / 'book'
  life_area      TEXT,                      -- school|home|work|money|health|personal|other
  status         TEXT NOT NULL DEFAULT 'active', -- review|active|done|paid|dismissed
  confidence     REAL NOT NULL DEFAULT 1.0, -- 0.0 .. 1.0
  source_excerpt TEXT,                      -- short quote justifying the task
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  completed_at   TEXT
);

-- Generated from a task plus its category offset rules (SPEC §8, phase 2).
CREATE TABLE IF NOT EXISTS reminders (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL REFERENCES tasks(id),
  user_id   TEXT NOT NULL REFERENCES users(id), -- denormalised for dispatcher queries
  fire_at   TEXT NOT NULL,                       -- ISO 8601 UTC
  channel   TEXT NOT NULL DEFAULT 'email',
  status    TEXT NOT NULL DEFAULT 'pending',     -- pending | sent | cancelled
  sent_at   TEXT
);

-- Records when a digest was last sent per user so the hourly job (phase 2)
-- does not double-send.
CREATE TABLE IF NOT EXISTS digest_log (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  sent_for  TEXT NOT NULL,   -- local date (YYYY-MM-DD) the digest covered
  sent_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status   ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due       ON tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_captures_user        ON captures(user_id, received_at);
CREATE INDEX IF NOT EXISTS idx_reminders_dispatch   ON reminders(status, fire_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_digest_per_day ON digest_log(user_id, sent_for);
