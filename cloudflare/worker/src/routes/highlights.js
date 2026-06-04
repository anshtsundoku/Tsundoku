import { all, first, run } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';
import { json } from '../lib/router.js';

export async function listHighlights(request, { env, url }) {
  const u = await currentUser(env, request);
  const post_id = url.searchParams.get('post_id');
  const domain  = url.searchParams.get('domain');
  if (post_id) {
    const rows = await all(env,
      `SELECT * FROM highlights WHERE post_id = ? AND user_id = ? ORDER BY created_at`,
      [post_id, u.id]);
    return json(rows);
  }
  if (domain) {
    const rows = await all(env, `
      SELECT h.*, p.title AS post_title, p.url AS post_url, d.slug AS domain_slug
        FROM highlights h
        JOIN posts p ON p.id = h.post_id
        JOIN domains d ON d.id = p.domain_id
       WHERE d.slug = ? AND h.user_id = ?
       ORDER BY h.created_at DESC
    `, [domain, u.id]);
    return json(rows);
  }
  const rows = await all(env, `
    SELECT h.*, p.title AS post_title, d.slug AS domain_slug
      FROM highlights h
      JOIN posts p ON p.id = h.post_id
      JOIN domains d ON d.id = p.domain_id
     WHERE h.user_id = ?
     ORDER BY h.created_at DESC LIMIT 200
  `, [u.id]);
  return json(rows);
}

export async function createHighlight(request, { env }) {
  const u = await currentUser(env, request);
  const { post_id, text, start_offset, end_offset, note } = await request.json();
  if (!post_id || !text) return json({ error: 'post_id and text required' }, 400);
  // Only allow highlighting a post the caller owns.
  const post = await first(env,
    `SELECT id FROM posts WHERE id = ? AND user_id = ?`, [post_id, u.id]);
  if (!post) return json({ error: 'post not found' }, 404);
  const h = await first(env, `
    INSERT INTO highlights (post_id, user_id, text, start_offset, end_offset, note)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *
  `, [post_id, u.id, text, start_offset ?? null, end_offset ?? null, note ?? null]);
  return json(h, 201);
}

export async function deleteHighlight(request, { env, params }) {
  const u = await currentUser(env, request);
  await run(env, `DELETE FROM highlights WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  return new Response(null, { status: 204 });
}
