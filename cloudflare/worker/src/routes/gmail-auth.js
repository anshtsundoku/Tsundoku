// Gmail integration via Google OAuth incremental authorization.
//
// Three handlers, wired in index.js:
//   GET  /api/auth/gmail/start      — auth-required; returns the Google consent URL
//   GET  /api/auth/gmail/callback   — ANONYMOUS (Google redirects the browser here)
//   POST /api/auth/gmail/disconnect — auth-required; clears tokens + gmail sources
//
// Requested scope: gmail.readonly (we only ever read). Tokens are AES-GCM
// encrypted (lib/crypto.js, keyed by env.ENCRYPTION_KEY) and stored on the
// users row. Required secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

import { currentUser } from '../lib/auth.js';
import { first, run } from '../lib/db.js';
import { getKv, setKv } from '../lib/kv.js';
import { encrypt } from '../lib/crypto.js';
import { json } from '../lib/router.js';

// Where Google redirects back to (must exactly match the registered redirect
// URI in the Google Cloud OAuth client). This is the Worker's own origin.
const API_BASE = 'https://tsundoku-api.ansh-tsundoku.workers.dev';
const REDIRECT_URI = `${API_BASE}/api/auth/gmail/callback`;
const FRONTEND_SETTINGS = 'https://tsundoku-e0v.pages.dev/settings';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

// OAuth state tokens live in the kv table for a short window. kv has no native
// TTL, so we stamp an expiry into the value and enforce it on lookup.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const stateKey = (token) => `gmail_oauth_state:${token}`;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// GET /api/auth/gmail/start — generate + persist a state token, return the
// Google OAuth consent URL for the client to redirect to.
export async function gmailStart(request, { env }) {
  const u = await currentUser(env, request);
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'google oauth not configured' }, 500);

  const state = randomToken();
  await setKv(env, stateKey(state), JSON.stringify({ user_id: u.id, exp: Date.now() + STATE_TTL_MS }));

  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         GMAIL_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return json({ url });
}

// GET /api/auth/gmail/callback — Google redirects the browser here with
// ?code=&state=. ANONYMOUS route: the app's bearer token isn't present, so we
// resolve the user from the state token instead. Always redirects back to the
// frontend (success or calm error), never throws a raw 500.
export async function gmailCallback(request, { env, url }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const fail = () => Response.redirect(`${FRONTEND_SETTINGS}?gmail_error=1`, 302);

  try {
    if (!code || !state) return fail();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ENCRYPTION_KEY) return fail();

    // 1. Resolve + consume the state token.
    const raw = await getKv(env, stateKey(state));
    if (!raw) return fail();
    await run(env, `DELETE FROM kv WHERE key = ?`, [stateKey(state)]);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return fail(); }
    if (!parsed?.user_id || !parsed?.exp || Date.now() > parsed.exp) return fail();
    const userId = parsed.user_id;

    // 2. Exchange the authorization code for tokens.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.warn('[gmail-auth] token exchange failed', tokenRes.status, await tokenRes.text().catch(() => ''));
      return fail();
    }
    const tok = await tokenRes.json();
    const accessToken = tok.access_token;
    const refreshToken = tok.refresh_token;
    if (!accessToken) return fail();

    // 3. Look up the connected Gmail address.
    let email = null;
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        email = info?.email || null;
      }
    } catch (e) {
      console.warn('[gmail-auth] userinfo failed', e.message);
    }

    // 4. Encrypt + persist the tokens. A refresh token may be absent if the
    //    user previously consented; keep any existing one in that case.
    const expiresAt = tok.expires_in
      ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString()
      : null;
    const accessEnc = await encrypt(accessToken, env.ENCRYPTION_KEY);
    const refreshEnc = refreshToken ? await encrypt(refreshToken, env.ENCRYPTION_KEY) : null;

    if (refreshEnc) {
      await run(env,
        `UPDATE users SET gmail_access_token_enc = ?, gmail_refresh_token_enc = ?,
                          gmail_expires_at = ?, gmail_email = ? WHERE id = ?`,
        [accessEnc, refreshEnc, expiresAt, email, userId]);
    } else {
      await run(env,
        `UPDATE users SET gmail_access_token_enc = ?, gmail_expires_at = ?, gmail_email = ? WHERE id = ?`,
        [accessEnc, expiresAt, email, userId]);
    }

    // 5. Back to the frontend.
    return Response.redirect(`${FRONTEND_SETTINGS}?gmail_connected=1`, 302);
  } catch (e) {
    console.error('[gmail-auth] callback failed', e.message);
    return fail();
  }
}

// POST /api/auth/gmail/disconnect — clear all gmail_* token fields + the
// connected address, and delete the user's gmail sources.
export async function gmailDisconnect(request, { env }) {
  const u = await currentUser(env, request);
  await run(env,
    `UPDATE users SET gmail_access_token_enc = NULL, gmail_refresh_token_enc = NULL,
                      gmail_expires_at = NULL, gmail_email = NULL WHERE id = ?`,
    [u.id]);
  await run(env, `DELETE FROM sources WHERE user_id = ? AND type = 'gmail'`, [u.id]);
  return new Response(null, { status: 204 });
}
