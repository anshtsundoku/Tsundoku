// Shared helper: insert a post (idempotent by source_id + external_id).
// All ingest pipelines call this. Cloudflare Worker runs in the same
// process as the fetch handler, so the frontend's next poll picks up the
// row immediately (no pub/sub needed).

import { run, first } from '../lib/db.js';

export async function upsertPost(env, post) {
  const src = await first(env, `SELECT id, user_id, domain_id FROM sources WHERE id = ?`, [post.source_id]);
  if (!src) return null;

  const existing = await first(env,
    `SELECT id FROM posts WHERE source_id = ? AND external_id = ?`,
    [src.id, post.external_id]
  );
  if (existing) return null;   // duplicate, already ingested

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
