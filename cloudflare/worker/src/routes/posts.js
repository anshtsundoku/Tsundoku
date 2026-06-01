import { all, first } from '../lib/db.js';
import { json } from '../lib/router.js';

export async function getPost(_req, { env, params }) {
  const p = await first(env, `
    SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
           s.display_name AS source_name, d.slug AS domain_slug
      FROM posts p
      JOIN sources s ON s.id = p.source_id
      JOIN domains d ON d.id = p.domain_id
     WHERE p.id = ?
  `, [params.id]);
  if (!p) return json({ error: 'not found' }, 404);
  return json(p);
}

export async function listPosts(_req, { env, url }) {
  const domain = url.searchParams.get('domain');
  const type   = url.searchParams.get('type');     // optional — used by TypeFeed
  const filter = url.searchParams.get('filter') || 'unread';
  const cursor = url.searchParams.get('cursor');
  const limit  = Math.min(Number(url.searchParams.get('limit') || 50), 100);
  if (!domain && !type) return json({ error: 'domain or type required' }, 400);

  const params = [];
  const wheres = [];
  if (domain) { params.push(domain); wheres.push(`d.slug = ?`); }
  if (type)   { params.push(type);   wheres.push(`s.type = ?`); }

  // Dismissed never shows. Filter selects which other state.
  // Weekend-saved posts are excluded from Read: marking something for the
  // weekend auto-moves it out of the Read tab into Weekend.
  const filterSql = filter === 'read'
    ? 'AND p.is_read = 1 AND p.is_weekend = 0 AND p.is_dismissed = 0'
    : filter === 'bookmark'
    ? 'AND p.is_bookmarked = 1 AND p.is_dismissed = 0'
    : filter === 'weekend'
    ? 'AND p.is_weekend = 1 AND p.is_dismissed = 0'
    : 'AND p.is_read = 0 AND p.is_dismissed = 0';

  let cursorSql = '';
  if (cursor) {
    params.push(cursor);
    cursorSql = `AND COALESCE(p.published_at, p.ingested_at) < ?`;
  }
  params.push(limit);

  const rows = await all(env, `
    SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
           s.display_name AS source_name, d.slug AS domain_slug
      FROM posts p
      JOIN sources s ON s.id = p.source_id
      JOIN domains d ON d.id = p.domain_id
     WHERE ${wheres.join(' AND ')}
       ${filterSql}
       ${cursorSql}
     ORDER BY COALESCE(p.published_at, p.ingested_at) DESC
     LIMIT ?
  `, params);
  return json(rows);
}

export async function patchPost(req, { env, params }) {
  const body = await req.json();
  const sets = [];
  const args = [];
  for (const key of ['is_read', 'is_bookmarked', 'is_dismissed', 'is_weekend']) {
    if (typeof body[key] === 'boolean') {
      args.push(body[key] ? 1 : 0);
      sets.push(`${key} = ?`);
    }
  }
  // Stamp read_at when is_read becomes true; clear on un-read.
  if (typeof body.is_read === 'boolean') {
    if (body.is_read) {
      args.push(new Date().toISOString());
      sets.push(`read_at = ?`);
    } else {
      sets.push(`read_at = NULL`);
    }
  }
  if (sets.length === 0) return json({ error: 'nothing to update' }, 400);
  args.push(params.id);
  const p = await first(env,
    `UPDATE posts SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    args
  );
  return json(p);
}

// GET /api/posts/search?q=…
// Substring match across title, tldr, and content_text. Skips dismissed.
// Returns at most 50 most-recent matches.
export async function searchPosts(_req, { env, url }) {
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json([]);
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = await all(env, `
    SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
           s.display_name AS source_name, d.slug AS domain_slug
      FROM posts p
      JOIN sources s ON s.id = p.source_id
      JOIN domains d ON d.id = p.domain_id
     WHERE p.is_dismissed = 0
       AND (
         p.title        LIKE ? ESCAPE '\\' OR
         p.content_text LIKE ? ESCAPE '\\' OR
         p.tldr         LIKE ? ESCAPE '\\'
       )
     ORDER BY COALESCE(p.published_at, p.ingested_at) DESC
     LIMIT 50
  `, [like, like, like]);
  return json(rows);
}

// GET /api/posts/library
// Everything bookmarked or saved-for-weekend, cross-domain, most-recent first.
export async function libraryPosts(_req, { env }) {
  let rows;
  try {
    rows = await all(env, `
      SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
             s.display_name AS source_name, d.slug AS domain_slug
        FROM posts p
        JOIN sources s ON s.id = p.source_id
        JOIN domains d ON d.id = p.domain_id
       WHERE (p.is_bookmarked = 1 OR p.is_weekend = 1)
         AND p.is_dismissed = 0
       ORDER BY COALESCE(p.published_at, p.ingested_at) DESC
       LIMIT 200
    `);
  } catch (e) {
    // is_weekend may be missing if migrate:v1_3 wasn't run
    if (/no such column.*is_weekend/i.test(e.message || '')) {
      rows = await all(env, `
        SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
               s.display_name AS source_name, d.slug AS domain_slug
          FROM posts p
          JOIN sources s ON s.id = p.source_id
          JOIN domains d ON d.id = p.domain_id
         WHERE p.is_bookmarked = 1 AND p.is_dismissed = 0
         ORDER BY COALESCE(p.published_at, p.ingested_at) DESC
         LIMIT 200
      `);
    } else throw e;
  }
  return json(rows);
}

// GET /api/posts/source-counts → [{ type, unread_count }]
// Powers the "New Reads/Watches" row on Home.
export async function sourceCounts(_req, { env }) {
  // Defensive: if is_weekend column is missing, the query still works because
  // we don't reference it here. The unread count excludes weekend? No — a
  // post can be weekend AND unread; we still surface it.
  const rows = await all(env, `
    SELECT s.type AS type,
           COALESCE(SUM(CASE WHEN p.is_read = 0 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS unread_count,
           COALESCE(SUM(CASE WHEN p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS total_count
      FROM sources s
      LEFT JOIN posts p ON p.source_id = s.id
     WHERE s.active = 1
     GROUP BY s.type
     ORDER BY s.type
  `);
  return json(rows);
}
