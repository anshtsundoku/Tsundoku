// Tsundoku API — Cloudflare Worker.
//
// Two entry points:
//   fetch()    → REST API (/api/*)
//   scheduled()→ cron-triggered ingestion + cleanup
//
// D1 is bound as env.DB. Secrets are bound as env.<name> (see wrangler.toml).

import { Router, json, handleOptions, withCors } from './lib/router.js';
import { currentUser } from './lib/auth.js';
import { listDomains, createDomain, updateDomain, deleteDomain } from './routes/domains.js';
import { listSources, createSource, deleteSource, patchSource, bulkNotifications, ingestNow } from './routes/sources.js';
import { listPosts, getPost, patchPost, sourceCounts, searchPosts, libraryPosts, markReadBulk } from './routes/posts.js';
import { listHighlights, createHighlight, deleteHighlight } from './routes/highlights.js';
import { triggerIngest, status, regenerateTldrs, geminiTest, pushAudit } from './routes/admin.js';
import { getPrefs, patchPrefs }            from './routes/prefs.js';
import { vapidPublicKey, subscribe, unsubscribe, pushStatus, vapidGen } from './routes/push.js';
import { googleAuth, logout, me, onboardingComplete, onboardingStep } from './routes/auth.js';
import { gmailStart, gmailCallback, gmailDisconnect } from './routes/gmail-auth.js';
import { getCredentials, patchCredential, deleteCredential } from './routes/credentials.js';
import { deleteAccount, exportData }        from './routes/account.js';
import { pair as extPair, status as extStatus, twitterCookies as extTwitterCookies,
         listPairings as extListPairings, deletePairing as extDeletePairing } from './routes/extension.js';

import { runRss }         from './ingest/rss.js';
import { runYoutube }     from './ingest/youtube.js';
import { runTwitter }     from './ingest/twitter.js';
import { runNewsletters } from './ingest/newsletter.js';
import { runGmail }       from './ingest/gmail.js';
import { runCleanup }     from './ingest/cleanup.js';

const router = new Router()
  .get('/api/health',                    () => json({ ok: true, app: 'tsundoku' }))
  // Auth (Phase 1 multi-tenancy plumbing — not yet enforced on other routes)
  .post('/api/auth/google',              googleAuth)
  .post('/api/auth/logout',              logout)
  .get('/api/auth/me',                   me)
  .post('/api/auth/onboarding-complete', onboardingComplete)
  .patch('/api/auth/onboarding-step',    onboardingStep)
  // Gmail OAuth (incremental auth, gmail.readonly). The callback is anonymous
  // (Google redirects the browser, no bearer token); start + disconnect require
  // a session.
  .get('/api/auth/gmail/start',          gmailStart)
  .get('/api/auth/gmail/callback',       gmailCallback)
  .post('/api/auth/gmail/disconnect',    gmailDisconnect)
  // Account lifecycle
  .delete('/api/account',                deleteAccount)
  .get('/api/account/export',            exportData)
  // Browser extension (x.com cookie sync). status + twitter-cookies use the
  // pairing bearer token (see ANONYMOUS_ROUTES); the rest use the session.
  .post('/api/extension/pair',           extPair)
  .get('/api/extension/status',          extStatus)
  .post('/api/extension/twitter-cookies', extTwitterCookies)
  .get('/api/extension/pairings',        extListPairings)
  .delete('/api/extension/pairings/:id', extDeletePairing)
  // Credential vault (per-user encrypted third-party keys)
  .get('/api/credentials',               getCredentials)
  .patch('/api/credentials',             patchCredential)
  .delete('/api/credentials/:kind',      deleteCredential)
  // Domains
  .get('/api/domains',                   listDomains)
  .post('/api/domains',                  createDomain)
  .patch('/api/domains/:id',             updateDomain)
  .delete('/api/domains/:id',            deleteDomain)
  // Sources
  .get('/api/sources',                   listSources)
  .post('/api/sources',                  createSource)
  .post('/api/sources/notifications/bulk', bulkNotifications)
  .post('/api/sources/:id/ingest-now',   ingestNow)
  .patch('/api/sources/:id',             patchSource)
  .delete('/api/sources/:id',            deleteSource)
  // Posts
  .get('/api/posts',                     listPosts)
  .post('/api/posts/mark-read-bulk',     markReadBulk)
  .get('/api/posts/source-counts',       sourceCounts)
  .get('/api/posts/search',              searchPosts)
  .get('/api/posts/library',             libraryPosts)
  .get('/api/posts/:id',                 getPost)
  .patch('/api/posts/:id',               patchPost)
  // Highlights
  .get('/api/highlights',                listHighlights)
  .post('/api/highlights',               createHighlight)
  .delete('/api/highlights/:id',         deleteHighlight)
  // Preferences (cross-device theme etc.)
  .get('/api/prefs',                     getPrefs)
  .patch('/api/prefs',                   patchPrefs)
  // Push notifications
  .get('/api/push/vapid-public-key',     vapidPublicKey)
  .get('/api/push/status',               pushStatus)
  .post('/api/push/subscribe',           subscribe)
  .delete('/api/push/subscribe',         unsubscribe)
  // Admin / debugging
  .get('/api/admin/status',              status)
  .post('/api/admin/trigger-ingest',     triggerIngest)
  .post('/api/admin/trigger-ingest/:pipeline', triggerIngest)
  .post('/api/admin/regenerate-tldrs',   regenerateTldrs)
  .get('/api/admin/gemini-test',         geminiTest)
  .get('/api/admin/push-audit',          pushAudit)
  .post('/api/admin/vapid-gen',          vapidGen);

// Routes that do NOT require a logged-in user. Everything else is gated by the
// auth check in fetch() below (which short-circuits with 401).
const ANONYMOUS_ROUTES = new Set([
  'GET /api/health',
  'POST /api/auth/google',
  'POST /api/auth/logout',
  // Google redirects the browser here after consent; no bearer token is
  // present. The handler authenticates via the OAuth state token instead.
  'GET /api/auth/gmail/callback',
  // Extension endpoints that authenticate with a pairing bearer token (not a
  // session). They verify the token themselves in routes/extension.js.
  'GET /api/extension/status',
  'POST /api/extension/twitter-cookies',
]);

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return handleOptions(request, env);

    // Auth gate: require a valid session on every route except the anonymous
    // allowlist. Routes still call currentUser() themselves to get the user id;
    // the result is memoized per-request, so this gate adds no extra D1 hit.
    const url = new URL(request.url);
    const routeKey = `${request.method} ${url.pathname}`;
    if (!ANONYMOUS_ROUTES.has(routeKey)) {
      try {
        await currentUser(env, request);
      } catch (e) {
        return withCors(json({ error: 'unauthorized' }, (e && e.status) || 401), request, env);
      }
    }

    return router.handle(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log(`[cron] ${cron} firing at ${new Date().toISOString()}`);
    try {
      if (cron === '*/5 * * * *')  ctx.waitUntil(runRss(env, ctx));
      if (cron === '*/15 * * * *') ctx.waitUntil(runYoutube(env, ctx));
      if (cron === '*/20 * * * *') ctx.waitUntil(runTwitter(env, ctx));
      if (cron === '*/10 * * * *') ctx.waitUntil(runNewsletters(env, ctx));
      if (cron === '*/10 * * * *') ctx.waitUntil(runGmail(env, ctx));
      if (cron === '0 3 * * *')    ctx.waitUntil(runCleanup(env));
    } catch (e) {
      console.error('[cron] dispatch failed', e);
    }
  },
};
