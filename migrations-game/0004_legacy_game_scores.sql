-- Preserve the link to a legacy Account D1 score when it is copied into Game D1.
-- NULL means the record was created natively in the Game DB.
ALTER TABLE game_scores ADD COLUMN legacy_source_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_scores_legacy_source_id
  ON game_scores(legacy_source_id)
  WHERE legacy_source_id IS NOT NULL;

-- Legacy rows whose duration is no longer an active Click Rush mode are retained here.
CREATE TABLE IF NOT EXISTS legacy_game_scores (
  source_id INTEGER PRIMARY KEY,
  game_slug TEXT NOT NULL,
  account_user_id INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  score INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  misses INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  combo5_count INTEGER NOT NULL DEFAULT 0,
  combo10_count INTEGER NOT NULL DEFAULT 0,
  combo20_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legacy_game_scores_account
  ON legacy_game_scores(account_user_id, game_slug, duration_seconds);
