-- Persist the most recent 9Grid action response so client retries are safe.
ALTER TABLE "9grid_sessions" ADD COLUMN last_action_id TEXT;
ALTER TABLE "9grid_sessions" ADD COLUMN last_action_response_json TEXT;

CREATE INDEX IF NOT EXISTS idx_9grid_sessions_last_action_id
  ON "9grid_sessions"(last_action_id);
