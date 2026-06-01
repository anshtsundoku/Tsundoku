-- Phase 1 multi-tenancy: Google OAuth identity columns on `users`.
--
-- These columns let a row in `users` be identified by a Google account
-- (`google_sub`) and carry display profile data. Nothing in the existing
-- single-user code path reads these yet — this is pure plumbing.
--
-- Idempotency: ALTER TABLE ADD COLUMN errors with "duplicate column name" if
-- run twice. That's expected and harmless (same convention as 0003_prefs.sql).
--
-- NOTE: `email` and `created_at` already exist on `users` (see 0001_init.sql),
-- so they are intentionally NOT re-added here — doing so would abort the
-- migration with a duplicate-column error. They remain available as-is:
--   -- ALTER TABLE users ADD COLUMN email      TEXT;                       (exists)
--   -- ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'));(exists)
--
-- SQLite cannot add a column with an inline UNIQUE constraint via ALTER TABLE,
-- so `google_sub` is added plain and uniqueness is enforced by a UNIQUE INDEX
-- below. SQLite treats NULLs as distinct, so the existing bootstrap row
-- (google_sub = NULL) is unaffected.

ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN name       TEXT;
ALTER TABLE users ADD COLUMN picture    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
