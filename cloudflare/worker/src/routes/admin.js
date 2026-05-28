// Admin endpoints. Useful for testing without waiting for cron.
//
// Protected by an X-Admin-Token header that must match the ADMIN_TOKEN
// Worker secret. If you put Cloudflare Access in front of the Pages site,
// this header check is redundant but harmless — Access already gates the
// /api proxy. Leave the token off → 401.

import { json } from '../lib/router.js';
import { runRss }         from '../ingest/rss.js';
import { runYoutube }     from '../ingest/youtube.js';
import { runTwitter }     from '../ingest/twitter.js';
import { runNewsletters } from '../ingest/newsletter.js';

const PIPELINES = {
  rss:         runRss,
  youtube:     runYoutube,
  twitter:     runTwitter,
  newsletters: runNewsletters,
};

function checkAuth(req, env) {
  if (!env.ADMIN_TOKEN) return true;   // not configured = anyone can hit admin (single-user demo OK)
  return req.headers.get('x-admin-token') === env.ADMIN_TOKEN;
}

// POST /api/admin/trigger-ingest      → run all four pipelines
// POST /api/admin/trigger-ingest/:pipeline → run one (rss | twitter | youtube | newsletters)
export async function triggerIngest(req, { env, ctx, params }) {
  if (!checkAuth(req, env)) return json({ error: 'unauthorized' }, 401);
  const which = params?.pipeline;
  const fns = which ? [PIPELINES[which]] : Object.values(PIPELINES);
  if (!fns.every(Boolean)) return json({ error: 'unknown pipeline' }, 400);

  // Run async with waitUntil so the response returns immediately.
  for (const fn of fns) {
    ctx.waitUntil(
      fn(env).catch(e => console.error(`[admin] pipeline failed:`, e.message))
    );
  }
  return json({ triggered: which || 'all', queued: fns.length });
}

// GET /api/admin/status → quick health view
export async function status(_req, { env }) {
  const { results: domains } = await env.DB.prepare(`
    SELECT slug, name,
      (SELECT COUNT(*) FROM posts WHERE domain_id=domains.id AND is_dismissed=0) AS total,
      (SELECT COUNT(*) FROM posts WHERE domain_id=domains.id AND is_read=0 AND is_dismissed=0) AS unread
    FROM domains ORDER BY sort_order
  `).all();
  const { results: sources } = await env.DB.prepare(`
    SELECT type, COUNT(*) AS n,
      MAX(last_polled_at) AS most_recent_poll
    FROM sources WHERE active=1 GROUP BY type
  `).all();
  return json({
    domains: domains || [],
    sources: sources || [],
    workerTime: new Date().toISOString(),
  });
}
