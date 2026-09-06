-- 9Grid score storage
-- Account identity is the internal users.id, never the Kakao user ID.
CREATE TABLE IF NOT EXISTS "9grid_scores" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_user_id INTEGER NOT NULL,
  max_round INTEGER NOT NULL CHECK (max_round >= 0),
  last_round_clear_turn INTEGER NOT NULL CHECK (last_round_clear_turn BETWEEN 0 AND 9),
  remaining_hp INTEGER NOT NULL CHECK (remaining_hp >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_9grid_scores_ranking
  ON "9grid_scores"(max_round DESC, last_round_clear_turn ASC, remaining_hp DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_9grid_scores_user
  ON "9grid_scores"(account_user_id, max_round DESC, created_at DESC);
