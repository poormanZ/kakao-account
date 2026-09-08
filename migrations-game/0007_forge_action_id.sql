-- Compatibility migration: action_id and its unique index are already part of 0006_forge_upgrade.sql.
-- Keep this migration as a no-op so environments that already recorded 0006 can advance
-- through the migration history without attempting to add the column twice.
SELECT 1;
