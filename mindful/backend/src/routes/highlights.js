import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// GET /api/highlights?post_id=
// GET /api/highlights?domain=<slug>     (notebook view)
router.get('/', async (req, res, next) => {
  try {
    const { post_id, domain } = req.query;
    if (post_id) {
      const { rows } = await query(
        `SELECT * FROM highlights WHERE post_id = $1 ORDER BY created_at`, [post_id]
      );
      return res.json(rows);
    }
    if (domain) {
      const { rows } = await query(`
        SELECT h.*, p.title AS post_title, p.url AS post_url, d.slug AS domain_slug
          FROM highlights h
          JOIN posts p ON p.id = h.post_id
          JOIN domains d ON d.id = p.domain_id
         WHERE d.slug = $1
         ORDER BY h.created_at DESC`, [domain]);
      return res.json(rows);
    }
    const { rows } = await query(
      `SELECT h.*, p.title AS post_title, d.slug AS domain_slug
         FROM highlights h JOIN posts p ON p.id = h.post_id
         JOIN domains d ON d.id = p.domain_id
        ORDER BY h.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { post_id, text, start_offset, end_offset, note } = req.body;
    if (!post_id || !text) return res.status(400).json({ error: 'post_id and text required' });
    const { rows: [user] } = await query(`SELECT id FROM users LIMIT 1`);
    const { rows: [h] } = await query(
      `INSERT INTO highlights (post_id, user_id, text, start_offset, end_offset, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [post_id, user.id, text, start_offset ?? null, end_offset ?? null, note ?? null]
    );
    res.status(201).json(h);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM highlights WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
