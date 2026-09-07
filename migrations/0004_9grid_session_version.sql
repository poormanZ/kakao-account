-- Add optimistic-locking version to server-authoritative 9Grid sessions.

ALTER TABLE "9grid_sessions" ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
