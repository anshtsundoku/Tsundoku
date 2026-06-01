// Account lifecycle — permanent deletion.
//
// DELETE /api/account wipes everything owned by the signed-in user. We delete
// children before parents explicitly (rather than relying on ON DELETE CASCADE,
// which D1 does not enforce unless PRAGMA foreign_keys is on), all inside one
// atomic batch. The session cookie is cleared on the way out.

import { currentUser } from '../lib/auth.js';

const SESSION_COOKIE = 'session';

function clearedCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

export async function deleteAccount(request, { env }) {
  const u = await currentUser(env, request);
  const uid = u.id;

  const stmt = (sql) => env.DB.prepare(sql).bind(uid);
  // Order matters: children → parents. Credentials live on the users row, so
  // they go with the final users delete.
  await env.DB.batch([
    stmt(`DELETE FROM push_subscriptions WHERE user_id = ?`),
    stmt(`DELETE FROM highlights         WHERE user_id = ?`),
    stmt(`DELETE FROM posts              WHERE user_id = ?`),
    stmt(`DELETE FROM sources            WHERE user_id = ?`),
    stmt(`DELETE FROM domains            WHERE user_id = ?`),
    stmt(`DELETE FROM users              WHERE id = ?`),
  ]);

  const res = new Response(null, { status: 204 });
  res.headers.append('Set-Cookie', clearedCookie());
  return res;
}
