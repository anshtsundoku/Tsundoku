// Daily cleanup pipeline.
//
// Rules:
//   * Read posts → deleted 7 days after read_at, UNLESS bookmarked or
//     in Weekend.
//   * Bookmarked posts stay forever.
//   * Weekend posts stay forever.
//   * Dismissed posts stay (we keep them to prevent re-ingest of the same
//     external_id from the feed).
//
// Defensive against the read_at / is_weekend columns being missing.

import { run } from '../lib/db.js';

export async function runCleanup(env) {
  try {
    const result = await run(env, `
      DELETE FROM posts
       WHERE is_read = 1
         AND is_bookmarked = 0
         AND is_weekend = 0
         AND read_at IS NOT NULL
         AND read_at < datetime('now', '-7 days')
    `);
    console.log(`[cleanup] swept ${result?.meta?.changes ?? '?'} read+aged posts`);
  } catch (e) {
    // Fall back: skip the weekend filter if column missing
    if (/no such column.*is_weekend/i.test(e.message || '')) {
      console.warn('[cleanup] is_weekend column missing — running without weekend safeguard');
      try {
        const result = await run(env, `
          DELETE FROM posts
           WHERE is_read = 1
             AND is_bookmarked = 0
             AND read_at IS NOT NULL
             AND read_at < datetime('now', '-7 days')
        `);
        console.log(`[cleanup] swept ${result?.meta?.changes ?? '?'} posts (no weekend filter)`);
      } catch (e2) {
        if (/no such column.*read_at/i.test(e2.message || '')) {
          console.warn('[cleanup] read_at column missing too — run migrate:v1_1');
          return;
        }
        throw e2;
      }
      return;
    }
    if (/no such column.*read_at/i.test(e.message || '')) {
      console.warn('[cleanup] read_at column missing — run migrate:v1_1');
      return;
    }
    throw e;
  }
}
