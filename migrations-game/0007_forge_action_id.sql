-- Client action ids make retries idempotent and prevent accidental duplicate mutations.
ALTER TABLE forge_action_logs ADD COLUMN action_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_forge_action_logs_user_action
  ON forge_action_logs(account_user_id, action_id)
  WHERE action_id IS NOT NULL;
