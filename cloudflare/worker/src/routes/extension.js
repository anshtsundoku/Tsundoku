// Browser-extension pairing + cookie sync.
//
// Two auth modes live here:
//   * Session-authenticated (currentUser): pair / list / revoke. These are
//     driven by the logged-in web app and are gated by the normal auth check.
//   * Bearer-authenticated (extension pairing token): status / twitter-cookies.
//     These are listed in ANONYMOUS_ROUTES (index.js) so the session gate skips
//     them; we authenticate the pairing token ourselves via lib/extToken.

import { currentUser } from '../lib/auth.js';
import { all, first, run } from '../lib/db.js';
import { encrypt } from '../lib/crypto.js';
import { json } from '../lib/router.js';
import { generateToken, hashToken, verifyToken } from '../lib/extToken.js';

// Min seconds between accepted cookie pushes per pairing.
const SYNC_MIN_INTERVAL_MS = 5000;

function readBearer(request) {
  const authz = request?.headers?.get('Authorization') || '';
  const m = authz.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// POST /api/extension/pair  (session auth)
// Body { name } → mints a fresh pairing token; returns the plaintext ONCE.
export async function pair(request, { env }) {
  const u = await currentUser(env, request);
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.slice(0, 200) : null;

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const r = await run(env,
    `INSERT INTO extension_pairings (user_id, token_hash, name) VALUES (?, ?, ?)`,
    [u.id, tokenHash, name]);

  return json({ token, id: r.meta?.last_row_id });
}

// GET /api/extension/status  (bearer auth)
export async function status(request, { env }) {
  const who = await verifyToken(env, readBearer(request));
  if (!who) return json({ error: 'invalid or revoked pairing' }, 401);
  const user = await first(env,
    `SELECT id, email, name FROM users WHERE id = ?`, [who.user_id]);
  if (!user) return json({ error: 'invalid or revoked pairing' }, 401);
  return json({ ok: true, user });
}

// POST /api/extension/twitter-cookies  (bearer auth)
// Body { auth_token, ct0 } → encrypts + stores on the paired user.
export async function twitterCookies(request, { env }) {
  if (!env.ENCRYPTION_KEY) return json({ error: 'server encryption key not configured' }, 500);

  // Resolve the pairing without stamping last_used_at yet, so we can use it as
  // the rate-limit clock for this write.
  const plain = readBearer(request);
  if (!plain) return json({ error: 'missing token' }, 401);
  const tokenHash = await hashToken(plain);
  const pairing = await first(env,
    `SELECT id, user_id, last_used_at FROM extension_pairings WHERE token_hash = ?`,
    [tokenHash]);
  if (!pairing) return json({ error: 'invalid or revoked pairing' }, 401);

  // Rate-limit: at most one accepted push per 5s per pairing.
  if (pairing.last_used_at) {
    const elapsed = Date.now() - new Date(pairing.last_used_at + 'Z').getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < SYNC_MIN_INTERVAL_MS) {
      return json({ error: 'rate limited' }, 429);
    }
  }

  const body = await request.json().catch(() => ({}));
  const authToken = body?.auth_token;
  const ct0 = body?.ct0;
  if (!authToken || !ct0) return json({ error: 'auth_token and ct0 required' }, 400);

  const [encAuth, encCt0] = await Promise.all([
    encrypt(String(authToken), env.ENCRYPTION_KEY),
    encrypt(String(ct0), env.ENCRYPTION_KEY),
  ]);
  await run(env,
    `UPDATE users SET twitter_auth_token_enc = ?, twitter_ct0_enc = ? WHERE id = ?`,
    [encAuth, encCt0, pairing.user_id]);
  await run(env,
    `UPDATE extension_pairings SET last_used_at = datetime('now') WHERE id = ?`,
    [pairing.id]);

  return new Response(null, { status: 204 });
}

// GET /api/extension/pairings  (session auth) — never returns tokens.
export async function listPairings(request, { env }) {
  const u = await currentUser(env, request);
  const rows = await all(env,
    `SELECT id, name, created_at, last_used_at
       FROM extension_pairings WHERE user_id = ? ORDER BY created_at DESC`,
    [u.id]);
  return json(rows);
}

// DELETE /api/extension/pairings/:id  (session auth)
export async function deletePairing(request, { env, params }) {
  const u = await currentUser(env, request);
  await run(env,
    `DELETE FROM extension_pairings WHERE id = ? AND user_id = ?`, [params.id, u.id]);
  return new Response(null, { status: 204 });
}
