-- Enforce unique service nicknames while allowing users without a nickname.
-- SQLite UNIQUE permits multiple NULL values, so first-time users can remain unset.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname_unique
  ON users(nickname)
  WHERE nickname IS NOT NULL;
