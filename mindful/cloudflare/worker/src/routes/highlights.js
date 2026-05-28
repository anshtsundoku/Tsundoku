import { all, first, run } from '../lib/db.js';
import { json } from '../lib/router.js';

export async function listHighlights(_req, { env, url }) {
  const post_id = url.searchParams.get('post_id');
  const domain  = url.searchParams.get('domain');
  if (post_id) {
    const rows = await all(env, `SELECT * FROM highlights WHERE post_id = ? ORDER BY created_at`, [post_id]);
    return json(rows);
  }
  if (domain) {
    const rows = await all(env, `
      SELECT h.*, p.title AS post_title, p.url AS post_url, d.slug AS domain_slug
        FROM highlights h
        JOIN posts p ON p.id = h.post_id
        JOIN domains d ON d.id = p.domain_id
       WHERE d.slug = ?
       ORDER BY h.created_at DESC
    `, [domain]);
    return json(rows);
  }
  const rows = await all(env, `
    SELECT h.*, p.title AS post_title, d.slug AS domain_slug
      FROM highlights h
      JOIN posts p ON p.id = h.post_id
      JOIN domains d ON d.id = p.domain_id
     ORDER BY h.created_at DESC LIMIT 200
  `);
  return json(rows);
}

export async function createHighlight(req, { env }) {
  const { post_id, text, start_offset, end_offset, note } = await req.json();
  if (!post_id || !text) return json({ error: 'post_id and text required' }, 400);
  const user = await first(env, `SELECT id FROM users LIMIT 1`);
  const h = await first(env, `
    INSERT INTO highlights (post_id, user_id, text, start_offset, end_offset, note)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING *
  `, [post_id, user.id, text, start_offset ?? null, end_offset ?? null, note ?? null]);
  return json(h, 201);
}

export async function deleteHighlight(_req, { env, params }) {
  await run(env, `DELETE FROM highlights WHERE id = ?`, [params.id]);
  return new Response(null, { status: 204 });
}
