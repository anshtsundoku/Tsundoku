-- Source health indicators. Each ingest attempt records the latest outcome so
-- the UI can show a per-source status dot.
--   'ok'      recent fetch that produced content
--   'idle'    fetch ok but no new content for 7d+
--   'error'   last fetch failed
--   'pending' never polled (default for new sources)
ALTER TABLE sources ADD COLUMN last_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE sources ADD COLUMN last_status_at TEXT;
