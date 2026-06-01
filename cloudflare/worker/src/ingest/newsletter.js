// Newsletter + Gmail-label ingestion via the Gmail API.
//
// Two source types share this pipeline:
//   * 'newsletter' — match incoming messages by sender address/domain
//   * 'gmail'      — match incoming messages by Gmail label name
//
// One-time OAuth: see DEPLOY-CF.md for the refresh-token walkthrough.
// Required secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.

import { all, first, run } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { stripHtml } from '../lib/textClean.js';
import { totalEmbeddedYoutubeMin } from '../lib/youtubeDurations.js';
import { upsertPost } from './_common.js';
import { decryptOrNull } from '../lib/userCreds.js';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function getAccessToken(env) {
  const params = new URLSearchParams({
    client_id:     env.GMAIL_CLIENT_ID,
    client_secret: env.GMAIL_CLIENT_SECRET,
    refresh_token: env.GMAIL_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!r.ok) throw new Error(`gmail token: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.access_token;
}

async function listMessageIds(token, sinceEpoch) {
  const q = encodeURIComponent(sinceEpoch ? `after:${sinceEpoch}` : 'in:inbox newer_than:7d');
  const ids = [];
  let pageToken = '';
  for (let i = 0; i < 4; i++) {
    const url = `${GMAIL}/messages?q=${q}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`gmail list: ${r.status}`);
    const data = await r.json();
    (data.messages || []).forEach(m => ids.push(m.id));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return ids;
}

async function fetchMessage(token, id) {
  const r = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`gmail get: ${r.status}`);
  return await r.json();
}

// Look up all Gmail labels once per tick (cheap, ~1 call) so we can resolve
// label NAMES (which the user enters) to internal label IDs (which messages
// carry). Returns a Map<lowercase-name, labelId>.
async function fetchLabelMap(token) {
  const r = await fetch(`${GMAIL}/labels`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`gmail labels: ${r.status}`);
  const data = await r.json();
  const map = new Map();
  for (const l of data.labels || []) {
    map.set(l.name.toLowerCase(), l.id);
  }
  return map;
}

function header(payload, name) {
  return payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeB64Url(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  try { return decodeURIComponent(escape(atob(s))); }
  catch { return atob(s); }
}

function extractParts(payload) {
  let html = '';
  let text = '';
  function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/html'  && p.body?.data) html = html || decodeB64Url(p.body.data);
    if (p.mimeType === 'text/plain' && p.body?.data) text = text || decodeB64Url(p.body.data);
    (p.parts || []).forEach(walk);
  }
  walk(payload);
  return { html, text };
}

function extractEmail(fromHeader) {
  const m = /<([^>]+)>/.exec(fromHeader);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

// Given a message, find which source(s) it matches.
//   1. Any 'newsletter' source whose identifier matches the sender address
//      or sender domain.
//   2. Any 'gmail' source whose identifier (label name) appears in the
//      message's labelIds (resolved via labelMap).
async function matchSources(env, msg, fromAddr, labelMap) {
  const matched = [];

  // Newsletter (sender match).
  const newsletterByAddr = await first(env,
    `SELECT * FROM sources
       WHERE type='newsletter' AND active=1 AND LOWER(identifier)=?`,
    [fromAddr]
  );
  if (newsletterByAddr) matched.push(newsletterByAddr);
  else {
    const domain = fromAddr.split('@')[1];
    if (domain) {
      const byDomain = await first(env,
        `SELECT * FROM sources
           WHERE type='newsletter' AND active=1 AND LOWER(identifier)=?`,
        [domain]
      );
      if (byDomain) matched.push(byDomain);
    }
  }

  // Gmail-label match.
  const msgLabelIds = new Set(msg.labelIds || []);
  const gmailSources = await all(env,
    `SELECT * FROM sources WHERE type='gmail' AND active=1`
  );
  for (const s of gmailSources) {
    const labelId = labelMap.get(s.identifier.toLowerCase());
    if (labelId && msgLabelIds.has(labelId)) matched.push(s);
  }

  return matched;
}

export async function runNewsletters(env) {
  // Per-user app-password IMAP is the multi-tenant target, but isn't built yet.
  // Surface who is waiting on it so it's visible in logs.
  const waiting = await all(env, `SELECT id FROM users WHERE gmail_imap_pass_enc IS NOT NULL`);
  if (waiting.length) {
    console.warn(`[gmail] per-user IMAP ingestion not yet implemented; ${waiting.length} user(s) waiting`);
  }

  // Legacy single-account OAuth path, gated behind a feature flag during the
  // migration. Set the wrangler var ENABLE_GMAIL_OAUTH="1" to keep it running.
  if (env.ENABLE_GMAIL_OAUTH !== '1') return;
  if (!env.GMAIL_REFRESH_TOKEN || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET) {
    console.warn('[gmail] OAuth enabled but secrets missing; skipping');
    return;
  }
  await runNewslettersOAuth(env);
}

// Per-user credential cache for the OAuth path (one Gmail account can deliver
// to newsletter sources owned by different users; each gets their own keys).
async function loadCreds(env, userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  const u = await first(env,
    `SELECT gemini_api_key_enc, yt_api_key_enc FROM users WHERE id = ?`, [userId]);
  const creds = {
    geminiApiKey: await decryptOrNull(env, u?.gemini_api_key_enc),
    ytApiKey:     await decryptOrNull(env, u?.yt_api_key_enc),
  };
  cache.set(userId, creds);
  return creds;
}

async function runNewslettersOAuth(env) {
  const credCache = new Map();
  const token = await getAccessToken(env);
  const labelMap = await fetchLabelMap(token);

  // Use the most-recent newsletter/gmail source's last_polled_at as the
  // "since" pointer.
  const cursor = await first(env,
    `SELECT MAX(last_polled_at) AS t FROM sources WHERE type IN ('newsletter','gmail')`
  );
  const sinceEpoch = cursor?.t
    ? Math.floor(new Date(cursor.t).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 7 * 86400;

  const ids = await listMessageIds(token, sinceEpoch);
  console.log(`[gmail] ${ids.length} candidate messages`);
  for (const id of ids) {
    try {
      const msg = await fetchMessage(token, id);
      const fromHeader = header(msg.payload, 'From');
      const subject    = header(msg.payload, 'Subject');
      const dateHeader = header(msg.payload, 'Date');
      const fromAddr   = extractEmail(fromHeader);

      const sources = await matchSources(env, msg, fromAddr, labelMap);
      if (sources.length === 0) continue;

      const { html, text } = extractParts(msg.payload);
      const body = text || stripHtml(html);
      if (!body) continue;

      // Summarize with the matched source owner's keys.
      const ownerId = sources[0].user_id;
      const { geminiApiKey, ytApiKey } = await loadCreds(env, ownerId, credCache);
      const { tldr, read_time_min: textMin } = await summarize(
        { title: subject, text: body, kind: 'newsletter', geminiApiKey }
      );

      // If the newsletter embeds YouTube videos, add their actual runtimes
      // so the "N min" badge reflects total time-to-consume, not just text.
      const embeddedVideoMin = await totalEmbeddedYoutubeMin(html, ytApiKey);
      const read_time_min = (textMin || 0) + embeddedVideoMin;

      // The same message can match more than one source (e.g. a label AND
      // a sender). Insert once per matching source so it shows up in each.
      for (const source of sources) {
        await upsertPost(env, {
          source_id:   source.id,
          external_id: msg.id,
          title:       subject || null,
          author:      fromHeader,
          url:         null,
          content_text: body,
          content_html: html || null,
          tldr,
          read_time_min,
          published_at: dateHeader ? new Date(dateHeader).toISOString() : null,
        });
      }
    } catch (e) {
      console.warn('[gmail] msg failed', id, e.message);
    }
  }

  // Bump all newsletter + gmail sources' poll timestamp.
  await run(env, `UPDATE sources SET last_polled_at = datetime('now') WHERE type IN ('newsletter','gmail')`);
}
