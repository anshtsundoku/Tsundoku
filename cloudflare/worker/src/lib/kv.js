// Minimal key/value accessor over the `kv` table (migration 0011). Used for
// small bits of cron bookkeeping (e.g. round-robin cursors).

import { first, run } from './db.js';

export async function getKv(env, key) {
  const row = await first(env, `SELECT value FROM kv WHERE key = ?`, [key]);
  return row ? row.value : null;
}

export async function setKv(env, key, value) {
  await run(env, `
    INSERT INTO kv (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `, [key, String(value)]);
}
