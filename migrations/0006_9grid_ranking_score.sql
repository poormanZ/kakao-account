-- 9Grid ranking v2
-- Score is derived from cleared rounds. Existing turn/HP fields remain only for backward-compatible historical rows.
ALTER TABLE "9grid_scores" ADD COLUMN score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0);
ALTER TABLE "9grid_scores" ADD COLUMN last_round_clear_at TEXT;

UPDATE "9grid_scores"
SET score = max_round * 1000,
    last_round_clear_at = created_at
WHERE score = 0;

CREATE INDEX IF NOT EXISTS idx_9grid_scores_ranking_v2
  ON "9grid_scores"(score DESC, last_round_clear_at ASC, id ASC);
