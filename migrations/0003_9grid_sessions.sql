-- Server-authoritative 9Grid game sessions.
-- The game state is scoped to the authenticated internal user id.

CREATE TABLE IF NOT EXISTS "9grid_sessions" (
  user_id INTEGER PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_9grid_sessions_updated_at ON "9grid_sessions"(updated_at);
