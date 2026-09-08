-- Forge game state lives in the dedicated Game D1 database.
-- account_user_id is the logical user id from the account database; no account tables are copied here.
CREATE TABLE IF NOT EXISTS forge_game_states (
  account_user_id INTEGER PRIMARY KEY,
  gold INTEGER NOT NULL CHECK (gold >= 0),
  current_weapon_json TEXT NOT NULL,
  shop_weapons_json TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forge_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forge_action_logs_user_created
  ON forge_action_logs(account_user_id, created_at DESC);
