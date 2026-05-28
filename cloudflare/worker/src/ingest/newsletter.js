// Newsletter ingestion via Gmail API in Workers.
//
// One-time OAuth: you authorize a desktop OAuth client against your dedicated
// newsletter Gmail account; this gives you a refresh_token, which we store as
// a secret. From then on the Worker exchanges it for a short-lived access
// token on every cron tick and lists/fetches messages over HTTPS.
//
// Required secrets:
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REFRESH_TOKEN
//
// See DEPLOY-CF.md for the OAuth setup walkthrough.

import { all, first, run } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { upsertPost } from './_common.js';

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
  // "after:" takes seconds since epoch.
  const q = encodeURIComponent(sinceEpoch ? `after:${sinceEpoch}` : 'in:inbox newer_than:7d');
  const ids = [];
  let pageToken = '';
  for (let i = 0; i < 4; i++) {   // up to 4 pages = 200 messages, plenty
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

function header(payload, name) {
  return payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeB64Url(b64) {
  // Gmail returns base64url. atob is available in Workers.
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  // We need UTF-8; decodeURIComponent escape trick handles it.
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

function stripHtml(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

function extractEmail(fromHeader) {
  const m = /<([^>]+)>/.exec(fromHeader);
  return (m ? m[1] : fromHeader).trim().toLowerCase();
}

async function findSource(env, fromAddr) {
  let s = await first(env,
    `SELECT * FROM sources WHERE type='newsletter' AND active=1 AND LOWER(identifier)=?`,
    [fromAddr]
  );
  if (s) return s;
  const domain = fromAddr.split('@')[1];
  if (!domain) return null;
  return await first(env,
    `SELECT * FROM sources WHERE type='newsletter' AND active=1 AND LOWER(identifier)=?`,
    [domain]
  );
}

export async function runNewsletters(env) {
  if (!env.GMAIL_REFRESH_TOKEN || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET) {
    console.warn('[gmail] OAuth secrets missing; skipping');
    return;
  }
  const token = await getAccessToken(env);

  // Use the most-recent newsletter source's last_polled_at as the "since"
  // pointer. (Simple heuristic; fine for one user.)
  const cursor = await first(env,
    `SELECT MAX(last_polled_at) AS t FROM sources WHERE type='newsletter'`
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
      const source     = await findSource(env, fromAddr);
      if (!source) continue;  // no matching newsletter source

      const { html, text } = extractParts(msg.payload);
      const body = text || stripHtml(html);
      if (!body) continue;

      const { tldr, read_time_min } = await summarize(env, { title: subject, text: body, kind: 'newsletter' });
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
    } catch (e) {
      console.warn('[gmail] msg failed', id, e.message);
    }
  }

  // Bump all newsletter sources' poll timestamp.
  await run(env, `UPDATE sources SET last_polled_at = datetime('now') WHERE type = 'newsletter'`);
}
