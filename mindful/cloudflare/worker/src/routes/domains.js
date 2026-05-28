import { all, first } from '../lib/db.js';
import { json } from '../lib/router.js';

export async function listDomains(_req, { env }) {
  const rows = await all(env, `
    SELECT
      d.id, d.name, d.slug, d.icon, d.sort_order,
      COALESCE(SUM(CASE WHEN p.is_read = 0 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS unread_count,
      COALESCE(SUM(CASE WHEN p.is_bookmarked = 1 AND p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS bookmark_count,
      COALESCE(SUM(CASE WHEN p.is_dismissed = 0 THEN 1 ELSE 0 END), 0) AS total_count
    FROM domains d
    LEFT JOIN posts p ON p.domain_id = d.id
    GROUP BY d.id
    ORDER BY d.sort_order, d.name
  `);
  return json(rows);
}

export async function createDomain(req, { env }) {
  const { name, slug, icon } = await req.json();
  if (!name || !slug) return json({ error: 'name and slug required' }, 400);
  const user = await first(env, `SELECT id FROM users LIMIT 1`);
  const d = await first(env,
    `INSERT INTO domains (user_id, name, slug, icon) VALUES (?, ?, ?, ?) RETURNING *`,
    [user.id, name, slug, icon || null]
  );
  return json(d, 201);
}
