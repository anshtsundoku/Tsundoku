-- Temporary mute for a source. ISO datetime; NULL = not paused, a value in the
-- future means ingestion skips this source until then.
ALTER TABLE sources ADD COLUMN paused_until TEXT;
