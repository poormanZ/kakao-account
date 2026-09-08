-- Forge idempotency belongs to the same aggregate row as the game state.
-- Keeping the latest processed action on forge_game_states removes a second
-- write dependency from the critical action path while preserving safe retries.
ALTER TABLE forge_game_states ADD COLUMN last_action_id TEXT;
ALTER TABLE forge_game_states ADD COLUMN last_action_result_json TEXT;

-- Legacy forge_action_logs is intentionally retained for historical data, but
-- new Forge actions no longer depend on it for correctness.
