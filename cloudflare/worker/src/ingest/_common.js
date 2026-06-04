// Shared helper: insert a post (idempotent by source_id + external_id).
// Enforces the "only new content from when the source was added" rule.

import { run, first } from '../lib/db.js';
import { notifyNewPost } from '../services/notify.js';

/**
 * Insert a post if it doesn't already exist AND it's newer than the
 * source's created_at (the moment the user added the source).
 *
 * Returns the inserted post, or null if it was a duplicate / pre-source-creation.
 */
export async function upsertPost(env, post) {
  const src = await first(env, `
    SELECT s.id, s.user_id, s.domain_id, s.created_at, s.type, s.display_name,
           s.notify_enabled, d.slug AS domain_slug, d.name AS domain_name
      FROM sources s JOIN domains d ON d.id = s.domain_id
     WHERE s.id = ?
  `, [post.source_id]);
  if (!src) return null;

  // Reject content older than the source's creation time. The user added
  // this source to track future content — they don't want a flood of
  // backfill from the source's archive.
  const publishedAt = post.published_at ? new Date(post.published_at) : null;
  const sourceCreatedAt = new Date(src.created_at);
  if (publishedAt && publishedAt < sourceCreatedAt) {
    return null;
  }

  const existing = await first(env,
    `SELECT id FROM posts WHERE source_id = ? AND external_id = ?`,
    [src.id, post.external_id]
  );
  if (existing) return null;

  const inserted = await first(env, `
    INSERT INTO posts
      (source_id, domain_id, user_id, external_id, title, author, url,
       content_text, content_html, image_url, video_url, tldr, read_time_min, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [
    src.id, src.domain_id, src.user_id, post.external_id,
    post.title || null, post.author || null, post.url || null,
    post.content_text || null, post.content_html || null,
    post.image_url || null, post.video_url || null,
    post.tldr || null, post.read_time_min || null,
    post.published_at || new Date().toISOString(),
  ]);

  await run(env, `UPDATE sources SET last_polled_at = datetime('now') WHERE id = ?`, [src.id]);

  // Fire-and-forget push notification for this new post. Skips internally
  // if VAPID isn't configured or the post is too old.
  try {
    await notifyNewPost(env, inserted, src.domain_slug, src.type, src.display_name, src.notify_enabled, src.domain_name);
  } catch (e) {
    console.warn('[notify] failed:', e.message);
  }

  return inserted;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Record the outcome of a per-source fetch into the health columns.
//   hadNew=true  → 'ok'   (recent fetch with content)
//   hadNew=false → keep current status but bump last_status_at; if the source
//                  has gone 7d+ without new content, downgrade to 'idle'.
export async function markSourceStatus(env, sourceId, hadNew) {
  if (hadNew) {
    await run(env,
      `UPDATE sources SET last_status='ok', last_status_at=datetime('now') WHERE id = ?`,
      [sourceId]);
    return;
  }
  const row = await first(env, `SELECT last_status_at FROM sources WHERE id = ?`, [sourceId]);
  const lastMs = row?.last_status_at
    ? new Date(String(row.last_status_at).replace(' ', 'T') + 'Z').getTime()
    : 0;
  const stale = !lastMs || (Date.now() - lastMs) >= SEVEN_DAYS_MS;
  if (stale) {
    await run(env,
      `UPDATE sources SET last_status='idle', last_status_at=datetime('now') WHERE id = ?`,
      [sourceId]);
  } else {
    await run(env,
      `UPDATE sources SET last_status_at=datetime('now') WHERE id = ?`,
      [sourceId]);
  }
}

// Record a failed fetch.
export async function markSourceError(env, sourceId) {
  await run(env,
    `UPDATE sources SET last_status='error', last_status_at=datetime('now') WHERE id = ?`,
    [sourceId]);
}
