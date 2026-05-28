-- Tsundoku — sample content seed. Optional, helps a fresh deploy not look empty.
-- Re-runnable safely (INSERT OR IGNORE).

-- Sources (id explicit so we can join to posts below).
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1001, u.id, d.id, 'rss', 'theathletic.com/football', 'The Athletic'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='football';
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1002, u.id, d.id, 'twitter', 'FabrizioRomano', '@FabrizioRomano'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='football';
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1003, u.id, d.id, 'newsletter', 'newsletter@stratechery.com', 'Stratechery'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='ai';
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1004, u.id, d.id, 'youtube', '@YannicKilcher', 'Yannic Kilcher'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='ai';
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1005, u.id, d.id, 'website', 'https://www.notboring.co', 'Not Boring'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='consumerism';
INSERT OR IGNORE INTO sources (id, user_id, domain_id, type, identifier, display_name)
SELECT 1006, u.id, d.id, 'newsletter', 'newsletter@lennysnewsletter.com', 'Lenny''s Newsletter'
  FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='product';

-- A few demo posts so the home screen has content immediately. Replace with real
-- content once you wire up sources; these can stay or be removed.
INSERT OR IGNORE INTO posts
  (source_id, domain_id, user_id, external_id, title, author, url, content_text, tldr, read_time_min, published_at, image_url)
SELECT 1001, d.id, u.id,
  'seed:football-1',
  'Why pressing defenses are dominating the Champions League',
  'The Athletic',
  'https://example.com/athletic-press',
  'A tactical breakdown of how high-pressure systems have reshaped European football this season. Top clubs are recovering possession in the final third more than ever, and the data tells an interesting story about why opposition managers are struggling to adapt.',
  'Pressing schemes are winning more high turnovers this UCL season. Coaches are struggling to counter without dropping deeper.',
  4,
  datetime('now', '-2 hours'),
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800'
FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='football';

INSERT OR IGNORE INTO posts
  (source_id, domain_id, user_id, external_id, title, author, url, content_text, tldr, read_time_min, published_at)
SELECT 1003, d.id, u.id,
  'seed:ai-1',
  'The shape of post-training',
  'Ben Thompson',
  'https://example.com/strat-1',
  'The frontier labs have quietly shifted where the value is created. Pre-training compute is no longer the bottleneck; post-training is doing the heavy lifting.',
  'Value in frontier models is shifting from pre-training to post-training. Reshapes moats and CapEx logic.',
  7,
  datetime('now', '-3 hours')
FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='ai';

INSERT OR IGNORE INTO posts
  (source_id, domain_id, user_id, external_id, title, author, url, content_text, tldr, read_time_min, published_at)
SELECT 1006, d.id, u.id,
  'seed:product-1',
  'How Linear approaches product reviews',
  'Lenny Rachitsky',
  'https://example.com/lenny-1',
  'Linear runs weekly product reviews differently from most companies — async-first, with a tight written template that forces the team to make explicit tradeoffs.',
  'Linear''s async-first product reviews force explicit tradeoffs in a tight written template.',
  5,
  datetime('now', '-5 hours')
FROM users u, domains d WHERE u.email='ansh.tsundoku@gmail.com' AND d.slug='product';
