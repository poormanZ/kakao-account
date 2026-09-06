-- Reaction Test uses a dedicated table because lower average reaction time ranks higher.
CREATE TABLE IF NOT EXISTS reaction_test_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_user_id INTEGER NOT NULL,
  average_ms INTEGER NOT NULL,
  best_ms INTEGER NOT NULL,
  successful_rounds INTEGER NOT NULL,
  false_starts INTEGER NOT NULL,
  timeouts INTEGER NOT NULL,
  round_times_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (average_ms > 0),
  CHECK (best_ms > 0),
  CHECK (successful_rounds BETWEEN 3 AND 5),
  CHECK (false_starts >= 0),
  CHECK (timeouts >= 0),
  CHECK (successful_rounds + false_starts + timeouts = 5)
);

CREATE INDEX IF NOT EXISTS idx_reaction_test_scores_user
  ON reaction_test_scores(account_user_id, average_ms, created_at);

CREATE INDEX IF NOT EXISTS idx_reaction_test_scores_ranking
  ON reaction_test_scores(average_ms, created_at);
