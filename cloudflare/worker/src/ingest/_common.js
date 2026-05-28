// Shared helper: insert a post (idempotent by source_id + external_id).
// Enforces the "only new content from when the source was added" rule.

import { run, first } from '../lib/db.js';

/**
 * Insert a post if it doesn't already exist AND it's newer than the
 * source's created_at (the moment the user added the source).
 *
 * Returns the inserted post, or null if it was a duplicate / pre-source-creation.
 */
export async function upsertPost(env, post) {
  const src = await first(env, `
    SELECT id, user_id, domain_id, created_at FROM sources WHERE id = ?
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
  return inserted;
}
