// Cross-device user preferences, scoped to the logged-in user. Currently
// `theme` and `ui_style`, but the JSON envelope makes it trivial to add more
// (e.g. default tab, poll cadence).
//
// Defensive against the prefs column not yet existing — if migration 0003
// hasn't been run, GET returns {} and PATCH 503s. The app keeps working
// (theme/ui_style fall back to per-device localStorage).

import { first, run } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';
import { json } from '../lib/router.js';

const ALLOWED_KEYS = new Set(['theme', 'ui_style']);

async function readPrefs(env, userId) {
  const row = await first(env, `SELECT prefs FROM users WHERE id = ?`, [userId]);
  try { return JSON.parse(row?.prefs || '{}'); } catch { return {}; }
}

export async function getPrefs(request, { env }) {
  try {
    const u = await currentUser(env, request);
    return json(await readPrefs(env, u.id));
  } catch (e) {
    console.warn('[prefs] read failed (column may be missing):', e.message);
    return json({});
  }
}

export async function patchPrefs(request, { env }) {
  const u = await currentUser(env, request);
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid JSON' }, 400); }

  try {
    const prefs = await readPrefs(env, u.id);
    for (const k of ALLOWED_KEYS) {
      if (k in body) prefs[k] = body[k];
    }
    await run(env, `UPDATE users SET prefs = ? WHERE id = ?`,
      [JSON.stringify(prefs), u.id]);
    return json(prefs);
  } catch (e) {
    console.warn('[prefs] write failed:', e.message);
    return json({ error: 'prefs unavailable; run migration 0003_prefs.sql' }, 503);
  }
}
