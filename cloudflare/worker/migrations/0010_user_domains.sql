-- Phase 3 multi-tenancy: per-user domains.
--
-- IMPORTANT — this migration is intentionally a SAFE, near-no-op.
--
-- The Phase 3 spec asked to ALTER TABLE domains ADD COLUMN user_id, tighten it
-- to NOT NULL via a table-rebuild, and add UNIQUE(user_id, slug). All of that
-- ALREADY EXISTS: the base schema (0001_init.sql) defines
--     user_id INTEGER NOT NULL,
--     UNIQUE(user_id, slug),
--     FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
-- and the live DB was created from it — listDomains() filters
-- `WHERE d.user_id = ?` and has been serving the app, which is only possible if
-- the column already exists.
--
-- Re-adding the column would abort with "duplicate column name", and a
-- table-rebuild (create/copy/drop/rename) would be actively DANGEROUS here:
-- sources.domain_id and posts.domain_id hold foreign-key references to
-- domains.id, so dropping/recreating `domains` risks orphaning them. We do NOT
-- rebuild. The per-user invariant is already enforced by 0001.
--
-- What this migration DOES (both idempotent / safe to run repeatedly):
--   1. Defensive backfill — give any legacy NULL user_id to the founder (id 1).
--      No-op on the current schema where user_id is already NOT NULL.
--   2. Belt-and-suspenders UNIQUE index on (user_id, slug). Harmless if the
--      table-level UNIQUE from 0001 already covers it.
--
-- Semantic change (no DDL needed): the `icon` column now stores a Lucide icon
-- NAME (e.g. "newspaper", "globe", "rocket") rather than a custom icon key.
-- Existing rows keep their old keys (football / sparkle / shopping / cube / …);
-- the frontend DomainIcon renderer maps those legacy keys to Lucide equivalents
-- and falls back gracefully, so no data rewrite is required.

UPDATE domains SET user_id = 1 WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_user_slug ON domains(user_id, slug);
