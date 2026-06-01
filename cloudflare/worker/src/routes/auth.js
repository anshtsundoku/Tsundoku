// Google Sign-In → first-party session cookie.
//
// Phase 1 plumbing only: these routes exist and work, but no other route is
// wired to require them yet (currentUser() still returns the single-user shim).
//
// Flow:
//   1. The client gets a Google ID token (One Tap / GIS button) and POSTs it
//      to /api/auth/google as { credential }.
//   2. We verify it against Google's published JWKs (RS256), check aud/iss/exp,
//      then UPSERT the user keyed on the Google `sub`.
//   3. We mint our own HS256 JWT and set it as an HttpOnly cookie named
//      "session". The client then calls /api/auth/me to read identity.

import { first, run } from '../lib/db.js';
import { json } from '../lib/router.js';
import { sign, verify } from '../lib/jwt.js';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches JWT default
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const decoder = new TextDecoder();

// ---- base64url + JWT segment helpers (Google ID tokens) -------------------
function bytesFromB64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function jsonFromB64url(s) {
  return JSON.parse(decoder.decode(bytesFromB64url(s)));
}

// ---- Google JWK cache (in worker memory, ~1 hour) -------------------------
let certsCache = { keys: null, expiresAt: 0 };

async function getGoogleCerts() {
  const now = Date.now();
  if (certsCache.keys && now < certsCache.expiresAt) return certsCache.keys;

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`failed to fetch Google certs (${res.status})`);
  const data = await res.json();

  // Honor the response's max-age when present, else default to 1 hour.
  let maxAgeSeconds = 3600;
  const cc = res.headers.get('cache-control');
  const m = cc && cc.match(/max-age=(\d+)/);
  if (m) maxAgeSeconds = parseInt(m[1], 10);

  certsCache = { keys: data.keys || [], expiresAt: now + maxAgeSeconds * 1000 };
  return certsCache.keys;
}

// Verify a Google ID token's RS256 signature + standard claims. Throws on any
// failure; returns the decoded payload on success.
async function verifyGoogleIdToken(idToken, env) {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured');

  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('malformed id token');

  const header = jsonFromB64url(parts[0]);
  const payload = jsonFromB64url(parts[1]);
  if (header.alg !== 'RS256') throw new Error(`unexpected token alg: ${header.alg}`);

  const certs = await getGoogleCerts();
  const jwk = certs.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found in Google certs');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    bytesFromB64url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('bad token signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error('token expired');
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error('token audience mismatch');
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error('bad token issuer');

  return payload;
}

// ---- user upsert (keyed on google_sub, links existing-by-email) -----------
async function upsertGoogleUser(env, { sub, email, name, picture }) {
  // 1. Already linked by Google sub → refresh profile.
  let u = await first(env, `SELECT id, email, name, picture FROM users WHERE google_sub = ?`, [sub]);
  if (u) {
    await run(env, `UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?`,
      [email, name || null, picture || null, u.id]);
    return { id: u.id, email, name: name || null, picture: picture || null };
  }

  // 2. Existing row with this email (e.g. the bootstrap single-user) → link it.
  u = await first(env, `SELECT id FROM users WHERE email = ?`, [email]);
  if (u) {
    await run(env, `UPDATE users SET google_sub = ?, name = ?, picture = ? WHERE id = ?`,
      [sub, name || null, picture || null, u.id]);
    return { id: u.id, email, name: name || null, picture: picture || null };
  }

  // 3. Brand-new user.
  const r = await run(env, `INSERT INTO users (email, google_sub, name, picture) VALUES (?, ?, ?, ?)`,
    [email, sub, name || null, picture || null]);
  return { id: r.meta?.last_row_id, email, name: name || null, picture: picture || null };
}

// ---- cookie helpers --------------------------------------------------------
function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  // HttpOnly so JS can't read it; Secure so it's HTTPS-only; SameSite=Lax.
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

// ---- routes ----------------------------------------------------------------
export async function googleAuth(request, { env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid JSON' }, 400); }

  const credential = body?.credential;
  if (!credential) return json({ error: 'missing credential' }, 400);

  let claims;
  try {
    claims = await verifyGoogleIdToken(credential, env);
  } catch (e) {
    console.warn('[auth] google token verification failed:', e.message);
    return json({ error: 'invalid Google credential' }, 401);
  }

  const { sub, email, name, picture } = claims;
  if (!sub || !email) return json({ error: 'token missing sub/email' }, 400);

  const user = await upsertGoogleUser(env, { sub, email, name, picture });
  const token = await sign({ uid: user.id, sub, email }, SESSION_MAX_AGE, env.JWT_SECRET);

  const res = json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture } });
  res.headers.append('Set-Cookie', sessionCookie(token, SESSION_MAX_AGE));
  return res;
}

export async function logout() {
  const res = new Response(null, { status: 204 });
  res.headers.append('Set-Cookie', sessionCookie('', 0)); // expire immediately
  return res;
}

export async function me(request, { env }) {
  const token = parseCookies(request)[SESSION_COOKIE];
  const payload = token ? await verify(token, env.JWT_SECRET) : null;
  if (!payload?.uid) return json({ error: 'unauthorized' }, 401);

  const user = await first(env, `SELECT id, email, name, picture FROM users WHERE id = ?`, [payload.uid]);
  if (!user) return json({ error: 'unauthorized' }, 401);

  return json({ user });
}
