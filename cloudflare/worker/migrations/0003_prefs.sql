-- Adds a `prefs` JSON column to users so cross-device preferences (currently:
-- theme) sync between your laptop and iPhone.
--
-- Safe to run once. If you run it a second time, the ALTER TABLE will fail
-- with "duplicate column name" — that's expected and harmless. The worker's
-- /api/prefs route degrades gracefully if the column is missing, so the app
-- never breaks because of this migration.

ALTER TABLE users ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}';
