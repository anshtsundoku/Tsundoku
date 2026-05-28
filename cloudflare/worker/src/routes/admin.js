// Admin endpoints. Useful for testing without waiting for cron.
//
// Protected by an X-Admin-Token header that must match the ADMIN_TOKEN
// Worker secret. If you put Cloudflare Access in front of the Pages site,
// this header check is redundant but harmless — Access already gates the
// /api proxy. Leave the token off → 401.

import { json } from '../lib/router.js';
import { all, first, run } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { runRss }         from '../ingest/rss.js';
import { runYoutube }     from '../ingest/youtube.js';
import { runTwitter }     from '../ingest/twitter.js';
import { runNewsletters } from '../ingest/newsletter.js';
import { runCleanup }     from '../ingest/cleanup.js';

const PIPELINES = {
  rss:         runRss,
  youtube:     runYoutube,
  twitter:     runTwitter,
  newsletters: runNewsletters,
  cleanup:     runCleanup,
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

// POST /api/admin/regenerate-tldrs
// Re-summarizes posts with missing or fallback ("(raw)") TLDRs using the
// current prompt. Useful after the TLDR prompt is improved — backfills the
// already-ingested content.
export async function regenerateTldrs(req, { env, ctx }) {
  if (!checkAuth(req, env)) return json({ error: 'unauthorized' }, 401);
  const limit = Math.min(Number((await safeJson(req))?.limit || 30), 100);

  // Fire-and-forget so the HTTP call returns immediately.
  ctx.waitUntil((async () => {
    const rows = await all(env, `
      SELECT id, title, content_text
        FROM posts
       WHERE (tldr IS NULL OR tldr = '' OR tldr LIKE '(raw)%')
         AND content_text IS NOT NULL
         AND LENGTH(content_text) > 0
       ORDER BY ingested_at DESC
       LIMIT ?
    `, [limit]);
    let updated = 0;
    for (const p of rows) {
      try {
        const { tldr } = await summarize(env, {
          title: p.title, text: p.content_text, kind: 'article',
        });
        if (tldr) {
          await run(env, `UPDATE posts SET tldr = ? WHERE id = ?`, [tldr, p.id]);
          updated++;
        }
      } catch (e) {
        console.warn('[regenerate-tldrs] post', p.id, 'failed:', e.message);
      }
    }
    console.log(`[regenerate-tldrs] updated ${updated}/${rows.length} posts`);
  })());

  return json({ queued: true, max: limit });
}

async function safeJson(req) {
  try { return await req.json(); } catch { return {}; }
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
