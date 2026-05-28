import { all, first } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';
import { json } from '../lib/router.js';

export async function listDomains(request, { env }) {
  const u = await currentUser(env, request);
  // Defensive about is_weekend column existing — falls back to 0 if missing.
  let rows;
  try {
    rows = await all(env, `
      SELECT
        d.id, d.name, d.slug, d.icon, d.sort_order,
        COALESCE(SUM(CASE WHEN p.is_read = 0 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS unread_count,
        COALESCE(SUM(CASE WHEN p.is_bookmarked = 1 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS bookmark_count,
        COALESCE(SUM(CASE WHEN p.is_weekend = 1 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS weekend_count,
        COALESCE(SUM(CASE WHEN p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS total_count
      FROM domains d
      LEFT JOIN posts p ON p.domain_id = d.id AND p.user_id = ?
      WHERE d.user_id = ?
      GROUP BY d.id
      ORDER BY d.sort_order, d.name
    `, [u.id, u.id]);
  } catch (e) {
    if (/no such column.*is_weekend/i.test(e.message || '')) {
      rows = await all(env, `
        SELECT
          d.id, d.name, d.slug, d.icon, d.sort_order,
          COALESCE(SUM(CASE WHEN p.is_read = 0 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS unread_count,
          COALESCE(SUM(CASE WHEN p.is_bookmarked = 1 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS bookmark_count,
          0 AS weekend_count,
          COALESCE(SUM(CASE WHEN p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS total_count
        FROM domains d
        LEFT JOIN posts p ON p.domain_id = d.id AND p.user_id = ?
        WHERE d.user_id = ?
        GROUP BY d.id
        ORDER BY d.sort_order, d.name
      `, [u.id, u.id]);
    } else throw e;
  }
  return json(rows);
}

export async function createDomain(request, { env }) {
  const u = await currentUser(env, request);
  const { name, slug, icon } = await request.json();
  if (!name || !slug) return json({ error: 'name and slug required' }, 400);
  const d = await first(env,
    `INSERT INTO domains (user_id, name, slug, icon) VALUES (?, ?, ?, ?) RETURNING *`,
    [u.id, name, slug, icon || null]
  );
  return json(d, 201);
}
