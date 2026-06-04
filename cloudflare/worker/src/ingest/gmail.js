// Per-user Gmail ingestion via the Gmail API (OAuth, gmail.readonly).
//
// Each user connects their own Gmail through Google OAuth (routes/gmail-auth.js)
// and adds 'gmail' sources whose identifier is a sender email address. This
// pipeline pulls recent messages from each sender into the feed.
//
// Tokens are AES-GCM encrypted (lib/crypto.js, keyed by env.ENCRYPTION_KEY).
// Access tokens are refreshed via the refresh-token grant when expired or on a
// 401; if a refresh still yields 401, the user's tokens are cleared (the user
// revoked access and must reconnect).

import { all, first, run } from '../lib/db.js';
import { summarize } from '../services/summarizer.js';
import { stripHtml } from '../lib/textClean.js';
import { upsertPost, markSourceStatus, markSourceError } from './_common.js';
import { encrypt } from '../lib/crypto.js';
import { decryptOrNull } from '../lib/userCreds.js';
import { selectUserBatch, yieldTick } from '../lib/cronFanout.js';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_PER_SENDER = 10;

export async function runGmail(env) {
  const rows = await all(env,
    `SELECT id FROM users WHERE gmail_access_token_enc IS NOT NULL`);
  const batch = await selectUserBatch(env, rows.map(r => r.id), 'gmail');
  for (const uid of batch) {
    try {
      await runGmailForUser(env, uid);
    } catch (e) {
      console.warn('[gmail] user', uid, 'failed:', e.message);
    }
    await yieldTick();
  }
}

async function runGmailForUser(env, userId) {
  if (!env.ENCRYPTION_KEY) {
    console.warn('[gmail] ENCRYPTION_KEY not configured; skipping');
    return;
  }
  const u = await first(env,
    `SELECT gmail_access_token_enc, gmail_refresh_token_enc, gmail_expires_at, gemini_api_key_enc
       FROM users WHERE id = ?`, [userId]);
  if (!u?.gmail_access_token_enc) return;

  const sources = await all(env,
    `SELECT * FROM sources WHERE user_id = ? AND type = 'gmail' AND active = 1
        AND (paused_until IS NULL OR paused_until <= datetime('now'))`, [userId]);
  if (sources.length === 0) return;

  const geminiApiKey = await decryptOrNull(env, u.gemini_api_key_enc);

  let accessToken = await decryptOrNull(env, u.gmail_access_token_enc);
  const refreshToken = await decryptOrNull(env, u.gmail_refresh_token_enc);

  // Proactively refresh if the stored token is expired (or missing).
  if ((isExpired(u.gmail_expires_at) || !accessToken) && refreshToken) {
    accessToken = await gmailRefresh(env, userId, refreshToken);
  }
  if (!accessToken) {
    console.warn('[gmail] user', userId, 'has no usable access token');
    return;
  }

  // Shared mutable token state so the 401-retry path can swap in a fresh token
  // mid-loop and only refresh once per tick.
  const tokenRef = { value: accessToken, refreshToken, refreshed: false };

  for (const s of sources) {
    try {
      const inserted = await ingestGmailSource(env, userId, s, tokenRef, geminiApiKey);
      await markSourceStatus(env, s.id, inserted > 0);
    } catch (e) {
      if (e?.code === 'gmail_unauthorized') {
        await clearTokens(env, userId);
        console.warn('[gmail] user', userId, 'tokens cleared after 401 (reconnect required)');
        return;
      }
      console.warn(`[gmail] ${s.identifier} failed`, e.message);
      await markSourceError(env, s.id);
    }
  }
}

// Manual single-source ingest (POST /api/sources/:id/ingest-now).
export async function ingestGmailSourceNow(env, s) {
  try {
    await runGmailForUser(env, s.user_id);
  } catch (e) {
    console.warn('[gmail] manual ingest failed', e.message);
  }
  const row = await first(env, `SELECT last_status FROM sources WHERE id = ?`, [s.id]);
  if (!row || row.last_status === 'pending') {
    await run(env,
      `UPDATE sources SET last_status='idle', last_status_at=datetime('now') WHERE id = ?`,
      [s.id]);
  }
  return 0;
}

async function ingestGmailSource(env, userId, s, tokenRef, geminiApiKey) {
  const sender = String(s.identifier || '').trim();
  if (!sender) return 0;

  const q = encodeURIComponent(`from:${sender}`);
  const list = await gmailApi(env, userId, tokenRef, `/messages?q=${q}&maxResults=${MAX_PER_SENDER}`);
  const ids = (list.messages || []).map(m => m.id);

  let inserted = 0;
  for (const id of ids) {
    // Dedupe before the expensive full fetch (upsertPost would reject it too,
    // but this avoids a wasted round-trip for already-seen messages).
    const existing = await first(env,
      `SELECT id FROM posts WHERE source_id = ? AND external_id = ?`, [s.id, id]);
    if (existing) continue;

    const msg = await gmailApi(env, userId, tokenRef, `/messages/${id}?format=full`);
    const subject    = header(msg.payload, 'Subject');
    const fromHeader = header(msg.payload, 'From');
    const dateHeader = header(msg.payload, 'Date');

    const { text, html } = decodeGmailBody(msg.payload);
    const body = text || stripHtml(html);
    if (!body) continue;

    const { tldr, read_time_min } = await summarize(
      { title: subject, text: body, kind: 'newsletter', geminiApiKey }
    );

    const post = await upsertPost(env, {
      source_id:    s.id,
      external_id:  id,
      title:        subject || null,
      author:       fromHeader || sender,
      url:          null,
      content_text: body,
      content_html: html || null,
      tldr,
      read_time_min,
      published_at: dateHeader ? new Date(dateHeader).toISOString() : null,
    });
    if (post) inserted++;
  }
  console.log(`[gmail] ${sender} ok (${ids.length}, ${inserted} new)`);
  return inserted;
}

// Authenticated Gmail API GET that refreshes the access token once on a 401.
// Throws a tagged error (code 'gmail_unauthorized') if still unauthorized after
// the refresh, so the caller can clear the user's tokens.
async function gmailApi(env, userId, tokenRef, path) {
  let res = await fetch(`${GMAIL}${path}`, {
    headers: { authorization: `Bearer ${tokenRef.value}` },
  });
  if (res.status === 401 && !tokenRef.refreshed && tokenRef.refreshToken) {
    tokenRef.refreshed = true;
    const fresh = await gmailRefresh(env, userId, tokenRef.refreshToken);
    if (fresh) {
      tokenRef.value = fresh;
      res = await fetch(`${GMAIL}${path}`, {
        headers: { authorization: `Bearer ${tokenRef.value}` },
      });
    }
  }
  if (res.status === 401) {
    const err = new Error('gmail unauthorized');
    err.code = 'gmail_unauthorized';
    throw err;
  }
  if (!res.ok) throw new Error(`gmail ${path.split('?')[0]}: ${res.status}`);
  return res.json();
}

// Exchange a refresh token for a fresh access token, re-encrypt it, and persist
// it (with the new expiry) on the user's row. Returns the plaintext access
// token, or null on failure.
export async function gmailRefresh(env, userId, refreshToken) {
  if (!refreshToken) return null;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.warn('[gmail] refresh skipped — google oauth not configured');
    return null;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) {
    console.warn('[gmail] refresh failed', res.status);
    return null;
  }
  const tok = await res.json();
  if (!tok.access_token) return null;
  const expiresAt = tok.expires_in
    ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString()
    : null;
  const accessEnc = await encrypt(tok.access_token, env.ENCRYPTION_KEY);
  await run(env,
    `UPDATE users SET gmail_access_token_enc = ?, gmail_expires_at = ? WHERE id = ?`,
    [accessEnc, expiresAt, userId]);
  return tok.access_token;
}

async function clearTokens(env, userId) {
  await run(env,
    `UPDATE users SET gmail_access_token_enc = NULL, gmail_refresh_token_enc = NULL,
                      gmail_expires_at = NULL WHERE id = ?`,
    [userId]);
}

// A stored expiry is "expired" if it's missing, unparseable, or within 60s of
// now (refresh early to avoid a token dying mid-request).
function isExpired(expiresAt) {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() >= t - 60000;
}

function header(payload, name) {
  return payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// base64url → string, handling UTF-8. Returns '' on malformed input.
function decodeB64Url(b64) {
  const s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
  try { return decodeURIComponent(escape(atob(s))); }
  catch { try { return atob(s); } catch { return ''; } }
}

// Walk the multipart MIME tree, returning the first text/plain and text/html
// parts found. base64url-decoded.
export function decodeGmailBody(payload) {
  let text = '';
  let html = '';
  function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body?.data) text = text || decodeB64Url(p.body.data);
    if (p.mimeType === 'text/html'  && p.body?.data) html = html || decodeB64Url(p.body.data);
    (p.parts || []).forEach(walk);
  }
  walk(payload);
  return { text, html };
}
