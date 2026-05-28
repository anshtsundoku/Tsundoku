import { all, first, run } from '../lib/db.js';
import { json } from '../lib/router.js';
import { discoverFeed } from '../services/feedDiscovery.js';

const ALLOWED = new Set(['rss','website','twitter','youtube','newsletter']);

export async function listSources(_req, { env, url }) {
  const domain = url.searchParams.get('domain');
  const sql = domain
    ? `SELECT s.*, d.slug AS domain_slug
         FROM sources s JOIN domains d ON d.id = s.domain_id
        WHERE d.slug = ? ORDER BY s.created_at DESC`
    : `SELECT s.*, d.slug AS domain_slug
         FROM sources s JOIN domains d ON d.id = s.domain_id
        ORDER BY s.created_at DESC`;
  const rows = await all(env, sql, domain ? [domain] : []);
  return json(rows);
}

export async function createSource(req, { env }) {
  const { type, identifier, domain_slug, display_name } = await req.json();
  if (!ALLOWED.has(type)) return json({ error: 'invalid type' }, 400);
  if (!identifier || !domain_slug) return json({ error: 'identifier and domain_slug required' }, 400);

  const d = await first(env, `SELECT id, user_id FROM domains WHERE slug = ? LIMIT 1`, [domain_slug]);
  if (!d) return json({ error: 'domain not found' }, 404);

  let feed_url = null;
  let discovery_warning = null;
  if (type === 'website') {
    feed_url = await discoverFeed(identifier);
    if (!feed_url) {
      discovery_warning = "Couldn't find an RSS feed on that site. We'll save it anyway — you can edit and supply a feed URL.";
    }
  } else if (type === 'rss') {
    feed_url = identifier;
  }

  // D1 SQLite "INSERT OR ... DO UPDATE" syntax:
  const s = await first(env, `
    INSERT INTO sources (user_id, domain_id, type, identifier, feed_url, display_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, type, identifier) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, sources.display_name),
      domain_id    = excluded.domain_id,
      feed_url     = COALESCE(excluded.feed_url, sources.feed_url),
      active       = 1
    RETURNING *`,
    [d.user_id, d.id, type, identifier, feed_url, display_name || identifier]
  );
  return json({ ...s, discovery_warning }, 201);
}

export async function deleteSource(_req, { env, params }) {
  await run(env, `DELETE FROM sources WHERE id = ?`, [params.id]);
  return new Response(null, { status: 204 });
}
