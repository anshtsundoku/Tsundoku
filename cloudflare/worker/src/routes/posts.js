import { all, first } from '../lib/db.js';
import { json } from '../lib/router.js';

export async function listPosts(_req, { env, url }) {
  const domain = url.searchParams.get('domain');
  const filter = url.searchParams.get('filter') || 'unread';
  const cursor = url.searchParams.get('cursor');
  const limit  = Math.min(Number(url.searchParams.get('limit') || 50), 100);
  if (!domain) return json({ error: 'domain required' }, 400);

  const params = [domain];
  const filterSql = filter === 'read'
    ? 'AND p.is_read = 1 AND p.is_dismissed = 0'
    : filter === 'bookmark'
    ? 'AND p.is_bookmarked = 1 AND p.is_dismissed = 0'
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
     WHERE d.slug = ?
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
  for (const key of ['is_read', 'is_bookmarked', 'is_dismissed']) {
    if (typeof body[key] === 'boolean') {
      args.push(body[key] ? 1 : 0);
      sets.push(`${key} = ?`);
    }
  }
  // Stamp read_at when is_read transitions to true (so the 7-day cleanup
  // pipeline knows when the clock started). Clear it when is_read flips false.
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
