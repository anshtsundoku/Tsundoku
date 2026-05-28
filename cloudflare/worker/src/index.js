// Tsundoku API — Cloudflare Worker.
//
// Two entry points:
//   fetch()    → REST API (/api/*)
//   scheduled()→ cron-triggered ingestion (RSS, Twitter, YouTube, Gmail)
//
// D1 is bound as env.DB. Secrets are bound as env.<name> (see wrangler.toml).

import { Router, json, handleOptions } from './lib/router.js';
import { listDomains, createDomain }       from './routes/domains.js';
import { listSources, createSource, deleteSource } from './routes/sources.js';
import { listPosts, patchPost }            from './routes/posts.js';
import { listHighlights, createHighlight, deleteHighlight } from './routes/highlights.js';
import { triggerIngest, status }           from './routes/admin.js';
import { getPrefs, patchPrefs }            from './routes/prefs.js';

import { runRss }       from './ingest/rss.js';
import { runYoutube }   from './ingest/youtube.js';
import { runTwitter }   from './ingest/twitter.js';
import { runNewsletters } from './ingest/newsletter.js';

const router = new Router()
  .get('/api/health',                    () => json({ ok: true, app: 'tsundoku' }))
  // Domains
  .get('/api/domains',                   listDomains)
  .post('/api/domains',                  createDomain)
  // Sources
  .get('/api/sources',                   listSources)
  .post('/api/sources',                  createSource)
  .delete('/api/sources/:id',            deleteSource)
  // Posts
  .get('/api/posts',                     listPosts)
  .patch('/api/posts/:id',               patchPost)
  // Highlights
  .get('/api/highlights',                listHighlights)
  .post('/api/highlights',               createHighlight)
  .delete('/api/highlights/:id',         deleteHighlight)
  // Preferences (cross-device theme etc.)
  .get('/api/prefs',                     getPrefs)
  .patch('/api/prefs',                   patchPrefs)
  // Admin / debugging
  .get('/api/admin/status',              status)
  .post('/api/admin/trigger-ingest',     triggerIngest)
  .post('/api/admin/trigger-ingest/:pipeline', triggerIngest);

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return handleOptions();
    return router.handle(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log(`[cron] ${cron} firing at ${new Date().toISOString()}`);
    try {
      if (cron === '*/5 * * * *')  ctx.waitUntil(runRss(env));
      if (cron === '*/15 * * * *') ctx.waitUntil(runYoutube(env));
      if (cron === '*/20 * * * *') ctx.waitUntil(runTwitter(env));
      if (cron === '*/10 * * * *') ctx.waitUntil(runNewsletters(env));
    } catch (e) {
      console.error('[cron] dispatch failed', e);
    }
  },
};
