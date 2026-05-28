// Tsundoku API — Cloudflare Worker.
//
// Two entry points:
//   fetch()    → REST API (/api/*)
//   scheduled()→ cron-triggered ingestion + cleanup
//
// D1 is bound as env.DB. Secrets are bound as env.<name> (see wrangler.toml).

import { Router, json, handleOptions } from './lib/router.js';
import { listDomains, createDomain }       from './routes/domains.js';
import { listSources, createSource, deleteSource, patchSource } from './routes/sources.js';
import { listPosts, getPost, patchPost, sourceCounts } from './routes/posts.js';
import { listHighlights, createHighlight, deleteHighlight } from './routes/highlights.js';
import { triggerIngest, status, regenerateTldrs } from './routes/admin.js';
import { getPrefs, patchPrefs }            from './routes/prefs.js';

import { runRss }         from './ingest/rss.js';
import { runYoutube }     from './ingest/youtube.js';
import { runTwitter }     from './ingest/twitter.js';
import { runNewsletters } from './ingest/newsletter.js';
import { runCleanup }     from './ingest/cleanup.js';

const router = new Router()
  .get('/api/health',                    () => json({ ok: true, app: 'tsundoku' }))
  // Domains
  .get('/api/domains',                   listDomains)
  .post('/api/domains',                  createDomain)
  // Sources
  .get('/api/sources',                   listSources)
  .post('/api/sources',                  createSource)
  .patch('/api/sources/:id',             patchSource)
  .delete('/api/sources/:id',            deleteSource)
  // Posts
  .get('/api/posts',                     listPosts)
  .get('/api/posts/source-counts',       sourceCounts)
  .get('/api/posts/:id',                 getPost)
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
  .post('/api/admin/trigger-ingest/:pipeline', triggerIngest)
  .post('/api/admin/regenerate-tldrs',   regenerateTldrs);

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
      if (cron === '0 3 * * *')    ctx.waitUntil(runCleanup(env));
    } catch (e) {
      console.error('[cron] dispatch failed', e);
    }
  },
};
