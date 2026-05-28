-- v1.3: Weekend reads.
--
-- Adds posts.is_weekend (0/1). Posts flagged "weekend" stay forever, like
-- bookmarks — the cleanup pipeline ignores them. The user toggles it from
-- the post card / detail page.
--
-- Idempotent caveat: re-running this migration fails on "duplicate column".
-- That's harmless — the cleanup pipeline and worker degrade gracefully if
-- the column is missing.

ALTER TABLE posts ADD COLUMN is_weekend INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_weekend
  ON posts(is_weekend, is_dismissed, published_at DESC);
