import { all, first, run } from '../lib/db.js';
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
  try {
    const d = await first(env,
      `INSERT INTO domains (user_id, name, slug, icon) VALUES (?, ?, ?, ?) RETURNING *`,
      [u.id, name, slug, icon || null]
    );
    return json(d, 201);
  } catch (e) {
    if (/UNIQUE constraint/i.test(e.message || '')) {
      return json({ error: 'you already have a domain with that slug' }, 409);
    }
    throw e;
  }
}

// PATCH /api/domains/:id — edit an owned domain. Body: { name?, slug?, icon?,
// sort_order? }. `icon` is a Lucide icon name. Ownership is enforced: a domain
// belonging to another user reads as "not found" (404), never editable.
export async function updateDomain(request, { env, params }) {
  const u = await currentUser(env, request);
  const existing = await first(env,
    `SELECT * FROM domains WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  if (!existing) return json({ error: 'domain not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const name = body.name ?? existing.name;
  const slug = body.slug ?? existing.slug;
  const icon = body.icon !== undefined ? body.icon : existing.icon;
  const sortOrder = body.sort_order ?? existing.sort_order;
  if (!name || !slug) return json({ error: 'name and slug required' }, 400);

  try {
    const d = await first(env, `
      UPDATE domains SET name = ?, slug = ?, icon = ?, sort_order = ?
       WHERE id = ? AND user_id = ?
      RETURNING *`,
      [name, slug, icon || null, sortOrder, params.id, u.id]);
    return json(d);
  } catch (e) {
    if (/UNIQUE constraint/i.test(e.message || '')) {
      return json({ error: 'you already have a domain with that slug' }, 409);
    }
    throw e;
  }
}

// DELETE /api/domains/:id — owned-only. Blocks (409) if any source still points
// at the domain; the user must remove those sources first (we do not cascade).
export async function deleteDomain(request, { env, params }) {
  const u = await currentUser(env, request);
  const existing = await first(env,
    `SELECT id FROM domains WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  if (!existing) return json({ error: 'domain not found' }, 404);

  const ref = await first(env,
    `SELECT COUNT(*) AS n FROM sources WHERE domain_id = ? AND user_id = ?`,
    [params.id, u.id]);
  if (ref && ref.n > 0) {
    return json({
      error: `remove this domain's ${ref.n} source${ref.n === 1 ? '' : 's'} first`,
      sources: ref.n,
    }, 409);
  }

  await run(env, `DELETE FROM domains WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  return new Response(null, { status: 204 });
}
