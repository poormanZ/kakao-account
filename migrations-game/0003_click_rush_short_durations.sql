-- Click Rush now uses 20s / 40s / 60s modes.
-- Rebuild the table because SQLite CHECK constraints cannot be altered directly.
CREATE TABLE IF NOT EXISTS game_scores_v3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_slug TEXT NOT NULL,
  account_user_id INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  score INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  misses INTEGER NOT NULL,
  max_combo INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (duration_seconds IN (20, 40, 60)),
  CHECK (score >= 0),
  CHECK (clicks >= 0),
  CHECK (misses >= 0),
  CHECK (max_combo >= 0)
);

INSERT INTO game_scores_v3 (
  id, game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo, created_at
)
SELECT id, game_slug, account_user_id, duration_seconds, score, clicks, misses, max_combo, created_at
FROM game_scores
WHERE duration_seconds = 60;

DROP TABLE game_scores;
ALTER TABLE game_scores_v3 RENAME TO game_scores;

CREATE INDEX IF NOT EXISTS idx_game_scores_game_duration_score
  ON game_scores(game_slug, duration_seconds, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_game_duration
  ON game_scores(account_user_id, game_slug, duration_seconds, score DESC);
