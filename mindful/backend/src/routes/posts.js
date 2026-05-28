import { Router } from 'express';
import { query } from '../db/index.js';

const router = Router();

// GET /api/posts?domain=<slug>&filter=<unread|read|bookmark>&cursor=<iso>
// Returns up to 50 posts ordered newest-first.
router.get('/', async (req, res, next) => {
  try {
    const { domain, filter = 'unread', cursor, limit = 50 } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const params = [domain];
    // Dismissed posts disappear from every tab. The 'bookmark' tab shows
    // bookmarked items regardless of read/unread state.
    const filterSql = filter === 'read'
      ? 'AND p.is_read = true AND p.is_dismissed = false'
      : filter === 'bookmark'
      ? 'AND p.is_bookmarked = true AND p.is_dismissed = false'
      : 'AND p.is_read = false AND p.is_dismissed = false';

    let cursorSql = '';
    if (cursor) {
      params.push(cursor);
      cursorSql = `AND COALESCE(p.published_at, p.ingested_at) < $${params.length}`;
    }
    params.push(Math.min(Number(limit) || 50, 100));

    const { rows } = await query(`
      SELECT p.*, s.type AS source_type, s.identifier AS source_identifier,
             s.display_name AS source_name, d.slug AS domain_slug
        FROM posts p
        JOIN sources s ON s.id = p.source_id
        JOIN domains d ON d.id = p.domain_id
       WHERE d.slug = $1
         ${filterSql}
         ${cursorSql}
       ORDER BY COALESCE(p.published_at, p.ingested_at) DESC
       LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { is_read, is_bookmarked, is_dismissed } = req.body;
    const sets = [];
    const params = [];
    if (typeof is_read === 'boolean')       { params.push(is_read);       sets.push(`is_read = $${params.length}`); }
    if (typeof is_bookmarked === 'boolean') { params.push(is_bookmarked); sets.push(`is_bookmarked = $${params.length}`); }
    if (typeof is_dismissed === 'boolean')  { params.push(is_dismissed);  sets.push(`is_dismissed = $${params.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });
    params.push(req.params.id);
    const { rows: [p] } = await query(
      `UPDATE posts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(p);
  } catch (e) { next(e); }
});

export default router;
