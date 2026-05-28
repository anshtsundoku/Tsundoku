// Publishes new posts to Redis so the API server can push them over WebSocket.
import Redis from 'ioredis';
import { query } from '../db/index.js';

let pub = null;
function getPub() {
  if (pub) return pub;
  pub = new Redis(process.env.REDIS_URL);
  return pub;
}

/**
 * Insert a post and notify subscribers in real time.
 * @param {object} post - { source_id, external_id, title, author, url,
 *                          content_text, content_html, image_url, video_url,
 *                          tldr, read_time_min, published_at }
 */
export async function insertAndNotify(post) {
  const { rows: [src] } = await query(
    `SELECT s.id, s.domain_id, s.user_id, d.slug AS domain_slug
       FROM sources s JOIN domains d ON d.id = s.domain_id
      WHERE s.id = $1`, [post.source_id]
  );
  if (!src) return null;

  const { rows: [p] } = await query(`
    INSERT INTO posts
      (source_id, domain_id, user_id, external_id, title, author, url,
       content_text, content_html, image_url, video_url, tldr, read_time_min, published_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (source_id, external_id) DO NOTHING
    RETURNING *`,
    [src.id, src.domain_id, src.user_id, post.external_id,
     post.title || null, post.author || null, post.url || null,
     post.content_text || null, post.content_html || null,
     post.image_url || null, post.video_url || null,
     post.tldr || null, post.read_time_min || null,
     post.published_at || new Date()]
  );

  if (!p) return null; // duplicate, already had it

  // Mark the source as polled.
  await query(`UPDATE sources SET last_polled_at = now() WHERE id = $1`, [src.id]);

  getPub().publish('posts.new', JSON.stringify({
    domain_slug: src.domain_slug,
    post: p,
  }));

  return p;
}
