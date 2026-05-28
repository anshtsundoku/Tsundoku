-- Mindful schema
-- One user (self-hosted, single-tenant for now). We keep a users table
-- so multi-user is a non-breaking change later.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  icon            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- A "source" is one feed of content. Type controls which worker handles it.
CREATE TABLE IF NOT EXISTS sources (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id       INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('rss','website','twitter','youtube','newsletter')),
  -- For rss/website: the feed URL.
  -- For twitter:    the handle (no @).
  -- For youtube:    the channel ID (UC...) or @handle.
  -- For newsletter: the sender email address (e.g. stratechery@stratechery.com).
  identifier      TEXT NOT NULL,   -- what the user pasted
  -- For 'website' type, identifier is the homepage URL and feed_url is the
  -- RSS/Atom feed we discovered. For other types, feed_url may be null.
  feed_url        TEXT,
  display_name    TEXT,
  last_polled_at  TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, identifier)
);

CREATE INDEX IF NOT EXISTS idx_sources_domain ON sources(domain_id);
CREATE INDEX IF NOT EXISTS idx_sources_type_active ON sources(type, active);

-- A post is a single piece of content from a source.
CREATE TABLE IF NOT EXISTS posts (
  id              SERIAL PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  domain_id       INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,   -- unique per source (url, guid, tweet id, msg id)
  title           TEXT,
  author          TEXT,
  url             TEXT,
  content_html    TEXT,            -- safe-rendered HTML
  content_text    TEXT,            -- plaintext for search and read-time calc
  image_url       TEXT,
  video_url       TEXT,
  tldr            TEXT,            -- AI-generated 2-line summary
  read_time_min   INTEGER,         -- estimated minutes to read
  published_at    TIMESTAMPTZ,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read         BOOLEAN NOT NULL DEFAULT false,
  is_bookmarked   BOOLEAN NOT NULL DEFAULT false,
  is_dismissed    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_domain_state ON posts(domain_id, is_read, is_bookmarked, is_dismissed, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_published ON posts(user_id, published_at DESC);

-- Highlights are text spans the user saved within a post.
CREATE TABLE IF NOT EXISTS highlights (
  id              SERIAL PRIMARY KEY,
  post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  -- Optional offsets so the highlight can be re-anchored in the rendered DOM.
  start_offset    INTEGER,
  end_offset      INTEGER,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_post ON highlights(post_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id, created_at DESC);

-- ── Idempotent additions (safe to re-run when upgrading an existing DB) ──
ALTER TABLE sources ADD COLUMN IF NOT EXISTS feed_url TEXT;
ALTER TABLE posts   ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN NOT NULL DEFAULT false;
