-- Store the exact combo milestone counts needed to reproduce Click Rush score server-side.
ALTER TABLE game_scores ADD COLUMN combo5_count INTEGER NOT NULL DEFAULT 0 CHECK (combo5_count >= 0);
ALTER TABLE game_scores ADD COLUMN combo10_count INTEGER NOT NULL DEFAULT 0 CHECK (combo10_count >= 0);
ALTER TABLE game_scores ADD COLUMN combo20_count INTEGER NOT NULL DEFAULT 0 CHECK (combo20_count >= 0);
