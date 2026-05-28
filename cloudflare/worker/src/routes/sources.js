import { all, first, run } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';
import { json } from '../lib/router.js';
import { discoverFeed } from '../services/feedDiscovery.js';

// Source types we expose to the API. 'rss' is intentionally NOT in the
// user-facing UI list (the frontend hides it) because 'website' covers that
// case via feed discovery — but the API still accepts it for forward-
// compatibility and for podcast/spotify which is RSS-driven under the hood.
const ALLOWED = new Set(['rss','website','twitter','youtube','newsletter','gmail','podcast']);

export async function listSources(request, { env, url }) {
  const u = await currentUser(env, request);
  const domain = url.searchParams.get('domain');
  const sql = domain
    ? `SELECT s.*, d.slug AS domain_slug
         FROM sources s JOIN domains d ON d.id = s.domain_id
        WHERE s.user_id = ? AND d.slug = ?
        ORDER BY s.created_at DESC`
    : `SELECT s.*, d.slug AS domain_slug
         FROM sources s JOIN domains d ON d.id = s.domain_id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC`;
  const params = domain ? [u.id, domain] : [u.id];
  const rows = await all(env, sql, params);
  return json(rows);
}

export async function createSource(request, { env }) {
  const u = await currentUser(env, request);
  const { type, identifier, domain_slug, display_name } = await request.json();
  if (!ALLOWED.has(type)) return json({ error: 'invalid type' }, 400);
  if (!identifier || !domain_slug) return json({ error: 'identifier and domain_slug required' }, 400);

  const d = await first(env,
    `SELECT id FROM domains WHERE slug = ? AND user_id = ? LIMIT 1`,
    [domain_slug, u.id]
  );
  if (!d) return json({ error: 'domain not found' }, 404);

  // For 'website' and 'podcast' we try to auto-discover the RSS feed.
  // Podcast platforms (Spotify, Apple, etc.) almost always have a public RSS;
  // the user pastes whatever URL they have, we attempt to find the actual feed.
  let feed_url = null;
  let discovery_warning = null;
  if (type === 'website' || type === 'podcast') {
    feed_url = await discoverFeed(identifier);
    if (!feed_url) {
      discovery_warning = type === 'podcast'
        ? "Couldn't find an RSS feed for that podcast. Most Spotify-exclusive shows don't expose one — try a non-exclusive show or paste the show's RSS URL directly."
        : "Couldn't find an RSS feed on that site. We'll save it anyway — you can edit and supply a feed URL.";
    }
  } else if (type === 'rss') {
    feed_url = identifier;
  }

  // Idempotent upsert. Tracks created_at via DEFAULT — we use this later in
  // the workers to only ingest items NEWER than this source's creation.
  const s = await first(env, `
    INSERT INTO sources (user_id, domain_id, type, identifier, feed_url, display_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, type, identifier) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, sources.display_name),
      domain_id    = excluded.domain_id,
      feed_url     = COALESCE(excluded.feed_url, sources.feed_url),
      active       = 1
    RETURNING *`,
    [u.id, d.id, type, identifier, feed_url, display_name || identifier]
  );
  return json({ ...s, discovery_warning }, 201);
}

export async function deleteSource(request, { env, params }) {
  const u = await currentUser(env, request);
  await run(env, `DELETE FROM sources WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  return new Response(null, { status: 204 });
}
