// Admin endpoints. Useful for testing without waiting for cron.
//
// Protected by an X-Admin-Token header that must match the ADMIN_TOKEN
// Worker secret. If you put Cloudflare Access in front of the Pages site,
// this header check is redundant but harmless — Access already gates the
// /api proxy. Leave the token off → 401.

import { json } from '../lib/router.js';
import { all, first, run } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { stripHtml } from '../lib/textClean.js';
import { totalEmbeddedYoutubeMin } from '../lib/youtubeDurations.js';
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
// Re-summarizes posts with missing or fallback ("(raw)") TLDRs. Also fixes
// the upstream cause of bad TLDRs: re-strips content_text from content_html
// using the new stripHtml that decodes entities and removes invisible
// tracker chars. Updates content_text, tldr, AND adds embedded YT video
// runtime into read_time_min — so this single backfill repairs all v1.3.2
// concerns for already-ingested posts.
export async function regenerateTldrs(req, { env, ctx }) {
  if (!checkAuth(req, env)) return json({ error: 'unauthorized' }, 401);
  const limit = Math.min(Number((await safeJson(req))?.limit || 30), 100);

  // Fire-and-forget so the HTTP call returns immediately.
  ctx.waitUntil((async () => {
    const rows = await all(env, `
      SELECT p.id, p.title, p.content_html, p.content_text, p.read_time_min,
             s.type AS source_type
        FROM posts p
        JOIN sources s ON s.id = p.source_id
       WHERE (p.tldr IS NULL OR p.tldr = '' OR p.tldr LIKE '(raw)%')
       ORDER BY p.ingested_at DESC
       LIMIT ?
    `, [limit]);
    let updated = 0;
    for (const p of rows) {
      try {
        // Re-derive clean text from the original HTML when we have it. This
        // is where the old `(raw)` posts get their entities decoded and
        // invisible chars stripped.
        const cleanedText = p.content_html ? stripHtml(p.content_html) : p.content_text;
        if (!cleanedText) continue;

        const kind = p.source_type === 'newsletter' ? 'newsletter'
                   : p.source_type === 'podcast'   ? 'podcast episode'
                   : 'article';
        const { tldr, read_time_min: textMin } = await summarize(env, {
          title: p.title, text: cleanedText, kind,
        });
        if (!tldr) continue;

        // For newsletters / blog posts that embed YouTube, also fold in the
        // embedded videos' real runtimes (the same fix from the live ingest
        // path, applied retroactively).
        const embedMin = (p.source_type === 'newsletter' || p.source_type === 'website')
          ? await totalEmbeddedYoutubeMin(p.content_html, env.YOUTUBE_API_KEY)
          : 0;
        const newReadTime = (textMin || 0) + embedMin;

        await run(env,
          `UPDATE posts SET tldr = ?, content_text = ?, read_time_min = ? WHERE id = ?`,
          [tldr, cleanedText, newReadTime, p.id]
        );
        updated++;
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
