// Daily cleanup pipeline.
//
// Source-content rules (from v1.1 spec):
//   * Read content auto-deletes 7 days after being marked read,
//     UNLESS bookmarked.
//   * Bookmarked content stays forever (until unbookmarked).
//   * Dismissed content also stays out of all feeds (handled at list time).
//
// We delete rather than soft-delete because D1 free tier has a 5GB cap and
// per-row state we no longer surface costs storage + makes future queries
// slower for no reason. The user can always re-bookmark before the 7-day
// window if they want to keep something.

import { run } from '../lib/db.js';

export async function runCleanup(env) {
  // is_read = 1 AND is_bookmarked = 0 AND read_at older than 7 days.
  // We don't touch dismissed posts here — those are already invisible and
  // deleting them is a separate concern (we keep them so the same external_id
  // doesn't re-ingest from a feed).
  try {
    const result = await run(env, `
      DELETE FROM posts
       WHERE is_read = 1
         AND is_bookmarked = 0
         AND read_at IS NOT NULL
         AND read_at < datetime('now', '-7 days')
    `);
    console.log(`[cleanup] swept ${result?.meta?.changes ?? '?'} read+aged posts`);
  } catch (e) {
    // If the read_at column doesn't exist yet (migration 0004 not run), skip
    // silently — the app still works.
    if (/no such column.*read_at/i.test(e.message || '')) {
      console.warn('[cleanup] read_at column missing — run migrate:v1_1 to enable 7-day expiry');
      return;
    }
    throw e;
  }
}
