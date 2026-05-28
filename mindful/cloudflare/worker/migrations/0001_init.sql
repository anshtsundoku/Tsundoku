-- Tsundoku D1 schema (SQLite flavored).
-- Booleans are 0/1 INTEGERs. Timestamps are TEXT ISO-8601.

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS domains (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slug),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  domain_id       INTEGER NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('rss','website','twitter','youtube','newsletter')),
  identifier      TEXT NOT NULL,
  feed_url        TEXT,
  display_name    TEXT,
  last_polled_at  TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, type, identifier),
  FOREIGN KEY(user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY(domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sources_domain     ON sources(domain_id);
CREATE INDEX IF NOT EXISTS idx_sources_type_active ON sources(type, active);

CREATE TABLE IF NOT EXISTS posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER NOT NULL,
  domain_id       INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  external_id     TEXT NOT NULL,
  title           TEXT,
  author          TEXT,
  url             TEXT,
  content_html    TEXT,
  content_text    TEXT,
  image_url       TEXT,
  video_url       TEXT,
  tldr            TEXT,
  read_time_min   INTEGER,
  published_at    TEXT,
  ingested_at     TEXT NOT NULL DEFAULT (datetime('now')),
  is_read         INTEGER NOT NULL DEFAULT 0,
  is_bookmarked   INTEGER NOT NULL DEFAULT 0,
  is_dismissed    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY(domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_domain_state ON posts(domain_id, is_read, is_bookmarked, is_dismissed, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_published ON posts(user_id, published_at DESC);

CREATE TABLE IF NOT EXISTS highlights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id       INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  text          TEXT NOT NULL,
  start_offset  INTEGER,
  end_offset    INTEGER,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_highlights_post ON highlights(post_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id, created_at DESC);

-- Bootstrap user + default domains.
INSERT OR IGNORE INTO users (email) VALUES ('ansh.tsundoku@gmail.com');

INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'Football',    'football',    'football', 1 FROM users u WHERE u.email='ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'AI',          'ai',          'sparkle',  2 FROM users u WHERE u.email='ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'Consumerism', 'consumerism', 'shopping', 3 FROM users u WHERE u.email='ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'Product',     'product',     'cube',     4 FROM users u WHERE u.email='ansh.tsundoku@gmail.com';
