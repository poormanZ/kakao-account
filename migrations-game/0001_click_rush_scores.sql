-- Click Rush score records owned by the dedicated Game D1 database.
-- account_user_id references the logical user id from kakao-account; no account tables are copied here.
CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_slug TEXT NOT NULL,
  account_user_id INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  score INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  misses INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (duration_seconds IN (60, 180, 300)),
  CHECK (score >= 0),
  CHECK (clicks >= 0),
  CHECK (misses >= 0),
  CHECK (max_combo >= 0)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_duration_score
  ON game_scores(game_slug, duration_seconds, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_game_duration
  ON game_scores(account_user_id, game_slug, duration_seconds, score DESC);
