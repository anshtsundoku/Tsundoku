// Cross-device user preferences. Currently just `theme`, but the JSON
// envelope makes it trivial to add more (e.g. default tab, poll cadence).
//
// Defensive against the prefs column not yet existing — if migration 0003
// hasn't been run, GET returns {} and PATCH 503s. The app keeps working
// (theme falls back to per-device localStorage).

import { first, run } from '../lib/db.js';
import { json } from '../lib/router.js';

const ALLOWED_KEYS = new Set(['theme']);

async function readPrefs(env) {
  const user = await first(env, `SELECT prefs FROM users LIMIT 1`);
  try { return JSON.parse(user?.prefs || '{}'); } catch { return {}; }
}

export async function getPrefs(_req, { env }) {
  try {
    return json(await readPrefs(env));
  } catch (e) {
    console.warn('[prefs] read failed (column may be missing):', e.message);
    return json({});
  }
}

export async function patchPrefs(req, { env }) {
  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid JSON' }, 400); }

  try {
    const user = await first(env, `SELECT id, prefs FROM users LIMIT 1`);
    let prefs = {};
    try { prefs = JSON.parse(user?.prefs || '{}'); } catch {}
    for (const k of ALLOWED_KEYS) {
      if (k in body) prefs[k] = body[k];
    }
    await run(env, `UPDATE users SET prefs = ? WHERE id = ?`,
      [JSON.stringify(prefs), user.id]);
    return json(prefs);
  } catch (e) {
    console.warn('[prefs] write failed:', e.message);
    return json({ error: 'prefs unavailable; run migration 0003_prefs.sql' }, 503);
  }
}
