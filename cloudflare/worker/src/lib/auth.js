// ============================================================================
// User-identity boundary — JWT session auth (Phase 2, ACTIVE).
//
// currentUser() resolves the requester from the "session" cookie that
// /api/auth/google issued:
//   1. Read the "session" cookie off the request.
//   2. Verify the HS256 JWT (lib/jwt.js) with env.JWT_SECRET.
//   3. Look the user up in D1 by the token's `uid` claim.
// It throws a 401-tagged Error when there is no valid session; the auth gate in
// index.js catches that and short-circuits the request with 401.
//
// currentUserOptional() returns null instead of throwing, for routes that want
// to handle anonymous callers gracefully.
//
// Founder adoption (see routes/auth.js): the first Google sign-in with
// env.OWNER_EMAIL adopts the bootstrap row (id=1), so all pre-existing
// single-user data (domains, sources, posts, highlights, push subs) carries
// over to that Google identity.
// ============================================================================

import { first } from './db.js';
import { verify } from './jwt.js';

const SESSION_COOKIE = 'session';

// Memoize the resolved user per request so the auth gate and the route handler
// don't each hit D1. Keyed on the Request object, so entries are GC'd with it.
const _perRequestUser = new WeakMap();

function readSessionToken(request) {
  // Bearer token wins. Cross-site clients (the Pages frontend lives on a
  // different registrable domain than this Worker, and iOS Safari blocks
  // third-party cookies) send the session JWT in the Authorization header.
  const authz = request?.headers?.get('Authorization') || '';
  if (/^Bearer\s+/i.test(authz)) {
    const t = authz.replace(/^Bearer\s+/i, '').trim();
    if (t) return t;
  }
  // Fall back to the first-party session cookie (works same-site / desktop).
  const header = request?.headers?.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}

// Resolve the current user from the session cookie. Returns the row
// { id, email, name, picture } or null. Never throws.
export async function currentUserOptional(env, request) {
  if (request && _perRequestUser.has(request)) return _perRequestUser.get(request);

  let user = null;
  const token = readSessionToken(request);
  if (token) {
    const payload = await verify(token, env.JWT_SECRET);
    if (payload?.uid) {
      user = (await first(env,
        `SELECT id, email, name, picture, onboarded_at, onboarding_step, gmail_email FROM users WHERE id = ?`, [payload.uid])) || null;
    }
  }

  if (request) _perRequestUser.set(request, user);
  return user;
}

// Resolve the current user, or throw a 401-tagged Error if the session is
// missing/invalid. The auth gate in index.js translates the throw into a 401.
export async function currentUser(env, request) {
  const user = await currentUserOptional(env, request);
  if (!user) {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  return user;
}
