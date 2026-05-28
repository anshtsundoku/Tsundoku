-- v1.1 migration:
--   * Add new domains: General (first), Geopolitics, India, Miscellaneous
--   * Re-order existing domains to make room for General at position 1
--   * Add posts.read_at — when a post was marked read (used for the 7-day expiry)
--
-- Idempotent: re-runnable with no side effects. INSERT OR IGNORE / UPDATE on slug.
-- The ALTER TABLE will error on re-run with "duplicate column name" — that's
-- expected and the worker degrades gracefully if the column is missing
-- (cleanup pipeline just no-ops).

-- 1. Posts.read_at — used by the cleanup pipeline to age out read items.
ALTER TABLE posts ADD COLUMN read_at TEXT;

-- 2. Shift existing domains down so General can sit at sort_order = 1.
UPDATE domains SET sort_order = 2 WHERE slug = 'football';
UPDATE domains SET sort_order = 3 WHERE slug = 'ai';
UPDATE domains SET sort_order = 4 WHERE slug = 'consumerism';
UPDATE domains SET sort_order = 5 WHERE slug = 'product';

-- 3. Insert the four new domains.
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'General',       'general',       'circle', 1
  FROM users u WHERE u.email = 'ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'Geopolitics',   'geopolitics',   'globe',  6
  FROM users u WHERE u.email = 'ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'India',         'india',         'flag',   7
  FROM users u WHERE u.email = 'ansh.tsundoku@gmail.com';
INSERT OR IGNORE INTO domains (user_id, name, slug, icon, sort_order)
SELECT u.id, 'Miscellaneous', 'miscellaneous', 'dots',   8
  FROM users u WHERE u.email = 'ansh.tsundoku@gmail.com';
