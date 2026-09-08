-- 9Grid ranking v2
-- Ranking is now based only on cleared rounds and authoritative round-clear time.
ALTER TABLE "9grid_scores" ADD COLUMN score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0);
ALTER TABLE "9grid_scores" ADD COLUMN last_round_clear_at TEXT;

-- Old records used HP/turn tie-breakers, so they are not valid under the new rules.
DELETE FROM "9grid_scores";

CREATE UNIQUE INDEX IF NOT EXISTS idx_9grid_scores_user_unique
  ON "9grid_scores"(account_user_id);

CREATE INDEX IF NOT EXISTS idx_9grid_scores_ranking_v2
  ON "9grid_scores"(score DESC, last_round_clear_at ASC, id ASC);
