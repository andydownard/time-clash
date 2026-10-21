-- Voice clips for read-aloud and Chrono lines. Additive only (global DB rule).
-- Not wired into the app yet: the database is "to be stood up" (see docs/ACCOUNTS_PLAN.md).
CREATE TABLE IF NOT EXISTS voice_clips (
  id          TEXT PRIMARY KEY,                 -- e.g. intro-01-welcome, bark-past-00
  kind        TEXT NOT NULL CHECK (kind IN ('intro','bark')),
  voice       TEXT NOT NULL,                    -- model voice id, e.g. am_michael
  engine      TEXT NOT NULL,                    -- e.g. kokoro-82m (Apache-2.0)
  text        TEXT NOT NULL,                    -- exactly what is spoken; also the caption source
  mime        TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  bytes       INTEGER NOT NULL,
  sha256      TEXT NOT NULL,
  audio       BLOB NOT NULL,
  created_at  TEXT NOT NULL                     -- UTC, ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_voice_clips_kind ON voice_clips(kind);
