-- Per-source push notification filter (master toggle remains device-level).
-- New sources default to notifying; users can mute individual sources in the UI.

ALTER TABLE sources ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1;
