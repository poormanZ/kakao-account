CREATE TABLE IF NOT EXISTS forge_game_states (
  user_id INTEGER PRIMARY KEY,
  gold INTEGER NOT NULL,
  current_weapon_json TEXT NOT NULL,
  shop_weapons_json TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS forge_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forge_action_logs_user_created
  ON forge_action_logs(user_id, created_at DESC);
