// Account lifecycle — permanent deletion.
//
// DELETE /api/account wipes everything owned by the signed-in user. We delete
// children before parents explicitly (rather than relying on ON DELETE CASCADE,
// which D1 does not enforce unless PRAGMA foreign_keys is on), all inside one
// atomic batch. The session cookie is cleared on the way out.

import { currentUser } from '../lib/auth.js';
import { all } from '../lib/db.js';

const SESSION_COOKIE = 'session';

// Drop any encrypted-credential columns (e.g. *_enc) from a row before export.
function stripEncColumns(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    if (!k.endsWith('_enc')) out[k] = row[k];
  }
  return out;
}

// GET /api/account/export — full data dump for the signed-in user, as a
// downloadable JSON attachment. Credentials are never included.
export async function exportData(request, { env }) {
  const u = await currentUser(env, request);
  const uid = u.id;

  const domains    = await all(env, `SELECT * FROM domains    WHERE user_id = ? ORDER BY sort_order, id`, [uid]);
  const sourcesRaw = await all(env, `SELECT * FROM sources    WHERE user_id = ? ORDER BY id`, [uid]);
  const posts      = await all(env, `SELECT * FROM posts      WHERE user_id = ? ORDER BY id`, [uid]);
  const highlights = await all(env, `SELECT * FROM highlights WHERE user_id = ? ORDER BY id`, [uid]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: u.id, email: u.email, name: u.name, picture: u.picture },
    domains,
    sources: (sourcesRaw || []).map(stripEncColumns),
    posts,
    highlights,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="tsundoku-export.json"',
    },
  });
}

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
