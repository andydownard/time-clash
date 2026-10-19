-- Clips keyed by the hash of the text (see src/audio/clipId.ts). Additive only (global DB rule).
-- Used by db/voice-k4.sqlite and later volumes. The older voice_clips table is left alone.
CREATE TABLE IF NOT EXISTS voice_clip_index (
  id          TEXT PRIMARY KEY,                 -- "t:" + FNV-1a 64-bit hex of the whitespace-normalized original text
  kind        TEXT NOT NULL CHECK (kind IN ('intro','bark','question','passage')),
  text        TEXT NOT NULL,                    -- the original text (what the game passes to speak(); also the caption source)
  text_sha256 TEXT NOT NULL,                    -- sha256 of the SPOKEN form the voice was given; a change means "regenerate"
  mime        TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  audio       BLOB NOT NULL,
  voice       TEXT NOT NULL,
  engine      TEXT NOT NULL,
  created_at  TEXT NOT NULL                     -- UTC, ISO 8601
);
