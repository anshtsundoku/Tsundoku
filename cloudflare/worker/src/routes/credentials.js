// Per-user third-party credential vault.
//
// Values are AES-GCM encrypted (lib/crypto.js, keyed by env.ENCRYPTION_KEY) and
// stored in the *_enc columns on `users` (migration 0009). The API NEVER echoes
// a stored value back — GET only reports which credentials are configured.

import { currentUser } from '../lib/auth.js';
import { first, run } from '../lib/db.js';
import { encrypt } from '../lib/crypto.js';
import { json } from '../lib/router.js';

// kind → the encrypted column(s) it maps to. This is a fixed allow-list, so the
// column names interpolated into SQL below are never attacker-controlled.
const COLUMNS = {
  yt:      ['yt_api_key_enc'],
  gemini:  ['gemini_api_key_enc'],
  gmail:   ['gmail_imap_pass_enc'],
  twitter: ['twitter_auth_token_enc', 'twitter_ct0_enc'],
};

// GET /api/credentials → { yt, gmail, twitter, gemini } booleans. Never values.
export async function getCredentials(request, { env }) {
  const u = await currentUser(env, request);
  const row = await first(env, `
    SELECT yt_api_key_enc, gmail_imap_pass_enc,
           twitter_auth_token_enc, twitter_ct0_enc, gemini_api_key_enc
      FROM users WHERE id = ?
  `, [u.id]);
  return json({
    yt:      Boolean(row?.yt_api_key_enc),
    gmail:   Boolean(row?.gmail_imap_pass_enc),
    twitter: Boolean(row?.twitter_auth_token_enc && row?.twitter_ct0_enc),
    gemini:  Boolean(row?.gemini_api_key_enc),
  });
}

// PATCH /api/credentials  body { kind, value }
//   value is a string for yt/gemini/gmail, or { auth_token, ct0 } for twitter.
export async function patchCredential(request, { env }) {
  const u = await currentUser(env, request);
  if (!env.ENCRYPTION_KEY) return json({ error: 'server encryption key not configured' }, 500);

  const body = await request.json().catch(() => ({}));
  const kind = body?.kind;
  if (!COLUMNS[kind]) return json({ error: 'unknown credential kind' }, 400);

  if (kind === 'twitter') {
    const authToken = body?.value?.auth_token;
    const ct0 = body?.value?.ct0;
    if (!authToken || !ct0) return json({ error: 'twitter requires auth_token and ct0' }, 400);
    const [encAuth, encCt0] = await Promise.all([
      encrypt(String(authToken), env.ENCRYPTION_KEY),
      encrypt(String(ct0), env.ENCRYPTION_KEY),
    ]);
    await run(env,
      `UPDATE users SET twitter_auth_token_enc = ?, twitter_ct0_enc = ? WHERE id = ?`,
      [encAuth, encCt0, u.id]);
    return json({ ok: true });
  }

  const value = body?.value;
  if (typeof value !== 'string' || !value.trim()) {
    return json({ error: 'value required' }, 400);
  }
  const col = COLUMNS[kind][0];
  const enc = await encrypt(value.trim(), env.ENCRYPTION_KEY);
  await run(env, `UPDATE users SET ${col} = ? WHERE id = ?`, [enc, u.id]);
  return json({ ok: true });
}

// DELETE /api/credentials/:kind → clears the relevant column(s).
export async function deleteCredential(request, { env, params }) {
  const u = await currentUser(env, request);
  const kind = params?.kind;
  if (!COLUMNS[kind]) return json({ error: 'unknown credential kind' }, 400);
  const setClause = COLUMNS[kind].map(c => `${c} = NULL`).join(', ');
  await run(env, `UPDATE users SET ${setClause} WHERE id = ?`, [u.id]);
  return new Response(null, { status: 204 });
}
