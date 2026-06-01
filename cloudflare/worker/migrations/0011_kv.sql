-- Phase 4 multi-tenancy: a tiny key/value table for cron bookkeeping.
--
-- Used by lib/cronFanout.js to remember the last user_id processed by each
-- per-user cron loop, so that when the user count grows past ~20 a single cron
-- tick only handles a chunk (round-robin) instead of every user at once.
--
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
