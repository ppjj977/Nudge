-- relay schema (SPEC §5). Timestamps are ISO 8601 UTC strings. JSON columns
-- hold loosely structured extras. IDs are text (nanoid, see lib/ids.ts).
-- This file is the single source of truth; scripts/migrate.ts applies it.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  image           TEXT,
  password_hash   TEXT,                                   -- scrypt; null for oauth/magic-link only
  timezone        TEXT NOT NULL DEFAULT 'Europe/London', -- IANA
  inbound_address TEXT UNIQUE,                            -- per-user forwarding addr (phase 3)
  digest_hour     INTEGER NOT NULL DEFAULT 7,             -- local hour
  settings        TEXT,                                   -- json: reminder offsets, retention prefs
  plan            TEXT NOT NULL DEFAULT 'free',           -- 'free' | 'pro'
  plan_until      TEXT,                                   -- ISO; null = perpetual pro
  plan_source     TEXT,                                   -- 'play' | 'stripe' | 'comp' | 'promo:CODE'
  created_at      TEXT NOT NULL
);

-- Promo / comp codes that grant Pro (full or for a period). Discounted *price*
-- is handled by the billing provider; these grant entitlement directly.
CREATE TABLE IF NOT EXISTS promo_codes (
  code            TEXT PRIMARY KEY,            -- uppercase
  grants          TEXT NOT NULL DEFAULT 'pro',
  duration_days   INTEGER,                     -- null = forever
  max_redemptions INTEGER,                     -- null = unlimited
  redeemed_count  INTEGER NOT NULL DEFAULT 0,
  expires_at      TEXT,                        -- when the code stops working
  note            TEXT,
  created_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  redeemed_at TEXT NOT NULL
);

-- Server-side sessions (SPEC §10a): the cookie holds the random session id.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,   -- the session token
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Single-use tokens for magic-link sign-in (and future password reset).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,      -- sha256 of the emailed token
  email      TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'magic',
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Households (Nudge Family). A user belongs to at most one household in v1.
CREATE TABLE IF NOT EXISTS households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  created_at   TEXT NOT NULL,
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS household_invites (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  email        TEXT NOT NULL,
  token_hash   TEXT NOT NULL,        -- sha256 of the emailed token
  invited_by   TEXT NOT NULL REFERENCES users(id),
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  created_at   TEXT NOT NULL
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
  end_at         TEXT,                      -- inclusive end date for multi-day spans (holidays/trips)
  amount         REAL,                      -- for 'pay'
  currency       TEXT,                      -- for 'pay', default 'GBP'
  location       TEXT,                      -- for 'attend' / 'book'
  life_area      TEXT,                      -- school|home|work|money|health|personal|other
  checklist      TEXT,                      -- json: [{text, done}] for grouped event tasks
  status         TEXT NOT NULL DEFAULT 'active', -- review|active|done|paid|dismissed
  confidence     REAL NOT NULL DEFAULT 1.0, -- 0.0 .. 1.0
  source_excerpt TEXT,                      -- short quote justifying the task
  snoozed_until  TEXT,                       -- ISO 8601 UTC of the next manual nudge
  household_id   TEXT REFERENCES households(id), -- shared to a family when set
  assignee_id    TEXT REFERENCES users(id),      -- shared task assigned to a member
  recurrence     TEXT,                            -- json: {freq, interval} for repeating tasks
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

-- Web push subscriptions (app notifications). One row per browser/device.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  endpoint   TEXT UNIQUE NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Native (Android/Capacitor) FCM device tokens for first-class app push.
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  token      TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

-- Shared family lists (shopping, packing, …). Shared when household_id is set.
CREATE TABLE IF NOT EXISTS lists (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),     -- creator
  household_id TEXT REFERENCES households(id),          -- shared to a family when set
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'custom',          -- shopping | packing | custom
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS list_items (
  id         TEXT PRIMARY KEY,
  list_id    TEXT NOT NULL REFERENCES lists(id),
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  added_by   TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status   ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due       ON tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_captures_user        ON captures(user_id, received_at);
CREATE INDEX IF NOT EXISTS idx_reminders_dispatch   ON reminders(status, fire_at);
CREATE INDEX IF NOT EXISTS idx_reminders_task        ON reminders(task_id, status);
CREATE INDEX IF NOT EXISTS idx_push_user             ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_user              ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user         ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash      ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_hh_members_user       ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hh_invites_hash       ON household_invites(token_hash);
-- NOTE: idx_tasks_household is created in applyAdditiveMigrations (db.ts) because
-- tasks.household_id is added by an ALTER on pre-existing databases.
CREATE UNIQUE INDEX IF NOT EXISTS uq_digest_per_day ON digest_log(user_id, sent_for);
CREATE INDEX IF NOT EXISTS idx_lists_user            ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_household        ON lists(household_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list        ON list_items(list_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_redemption  ON promo_redemptions(code, user_id);
