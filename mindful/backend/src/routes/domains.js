import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// GET /api/domains  → list with unread counts
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        d.id, d.name, d.slug, d.icon, d.sort_order,
        COALESCE(SUM(CASE WHEN p.is_read = false AND p.is_dismissed = false THEN 1 ELSE 0 END), 0)::int AS unread_count,
        COALESCE(SUM(CASE WHEN p.is_bookmarked = true AND p.is_dismissed = false THEN 1 ELSE 0 END), 0)::int AS bookmark_count,
        COALESCE(SUM(CASE WHEN p.is_dismissed = false THEN 1 ELSE 0 END), 0)::int AS total_count
      FROM domains d
      LEFT JOIN posts p ON p.domain_id = d.id
      GROUP BY d.id
      ORDER BY d.sort_order, d.name
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/domains  → create a new domain
router.post('/', async (req, res, next) => {
  try {
    const { name, slug, icon } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
    const { rows: [user] } = await query(`SELECT id FROM users LIMIT 1`);
    const { rows: [d] } = await query(
      `INSERT INTO domains (user_id, name, slug, icon)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.id, name, slug, icon || null]
    );
    res.status(201).json(d);
  } catch (e) { next(e); }
});

export default router;
