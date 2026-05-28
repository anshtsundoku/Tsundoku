import { Router } from 'express';
import { query } from '../db/index.js';
import { discoverFeed } from '../services/feedDiscovery.js';

const router = Router();

const ALLOWED_TYPES = new Set(['rss','website','twitter','youtube','newsletter']);

// GET /api/sources?domain=<slug>
router.get('/', async (req, res, next) => {
  try {
    const { domain } = req.query;
    const sql = domain
      ? `SELECT s.*, d.slug AS domain_slug
           FROM sources s JOIN domains d ON d.id = s.domain_id
          WHERE d.slug = $1 ORDER BY s.created_at DESC`
      : `SELECT s.*, d.slug AS domain_slug
           FROM sources s JOIN domains d ON d.id = s.domain_id
          ORDER BY s.created_at DESC`;
    const params = domain ? [domain] : [];
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/sources  { type, identifier, domain_slug, display_name? }
router.post('/', async (req, res, next) => {
  try {
    const { type, identifier, domain_slug, display_name } = req.body;
    if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: 'invalid type' });
    if (!identifier || !domain_slug) return res.status(400).json({ error: 'identifier and domain_slug required' });

    const { rows: [d] } = await query(
      `SELECT id, user_id FROM domains WHERE slug = $1 LIMIT 1`, [domain_slug]
    );
    if (!d) return res.status(404).json({ error: 'domain not found' });

    // For a 'website', auto-discover the RSS/Atom feed. This is what lets
    // the user paste e.g. https://stratechery.com and have it Just Work.
    let feed_url = null;
    let discovery_warning = null;
    if (type === 'website') {
      feed_url = await discoverFeed(identifier);
      if (!feed_url) {
        discovery_warning = "Couldn't find an RSS feed on that site. We'll save it anyway — you can edit the source if you know the feed URL.";
      }
    } else if (type === 'rss') {
      // For 'rss' the identifier is itself the feed URL.
      feed_url = identifier;
    }

    const { rows: [s] } = await query(
      `INSERT INTO sources (user_id, domain_id, type, identifier, feed_url, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, type, identifier)
       DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, sources.display_name),
                     domain_id   = EXCLUDED.domain_id,
                     feed_url    = COALESCE(EXCLUDED.feed_url, sources.feed_url),
                     active      = true
       RETURNING *`,
      [d.user_id, d.id, type, identifier, feed_url, display_name || identifier]
    );
    res.status(201).json({ ...s, discovery_warning });
  } catch (e) { next(e); }
});

// DELETE /api/sources/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM sources WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
