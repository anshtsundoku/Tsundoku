// In-process Twitter scraper using rettiwt-api. No extra container needed.
// Authenticated via your own Twitter session cookies (set in .env), which
// gives much better reliability than guest-only paths like Nitter.
//
// Source.identifier for type='twitter' is the bare handle, no @.
//
// Env vars:
//   TWITTER_AUTH_TOKEN  (cookie name: auth_token)
//   TWITTER_CT0         (cookie name: ct0)
//   TWITTER_GUEST_ID    (cookie name: guest_id, optional)
//   TWITTER_KDT         (cookie name: kdt, optional)
//
// See DEPLOY.md "Twitter cookie setup" for the 5-minute browser-extract
// instructions. If cookies aren't set, the worker logs a warning and skips.

import { Rettiwt } from 'rettiwt-api';
import { query } from '../db/index.js';
import { insertAndNotify } from '../services/publisher.js';
import { summarize } from '../services/summarizer.js';

let rettiwt = null;
function getClient() {
  if (rettiwt) return rettiwt;
  const auth_token = process.env.TWITTER_AUTH_TOKEN;
  const ct0        = process.env.TWITTER_CT0;
  if (!auth_token || !ct0) return null;

  // Compose a Twitter cookie string from the parts. rettiwt-api accepts
  // a full cookie header via the `apiKey` option.
  const parts = [
    process.env.TWITTER_KDT      && `kdt=${process.env.TWITTER_KDT}`,
    process.env.TWITTER_GUEST_ID && `guest_id=${process.env.TWITTER_GUEST_ID}`,
    `auth_token=${auth_token}`,
    `ct0=${ct0}`,
  ].filter(Boolean).join('; ');

  rettiwt = new Rettiwt({ apiKey: parts });
  return rettiwt;
}

// Returns up to N most-recent tweets from a user as a normalized list.
async function fetchTimeline(handle, max = 10) {
  const client = getClient();
  if (!client) return null;
  // rettiwt: resolve user → fetch their tweets.
  const user = await client.user.details(handle);
  if (!user) throw new Error(`user not found: ${handle}`);
  const result = await client.user.tweets(user.id, max);
  // result has an `.list` of tweet objects with id, createdAt, fullText,
  // media (array of {url, type}), and url.
  return result?.list || [];
}

export async function runTwitterOnce() {
  if (!getClient()) {
    console.warn('[twitter] cookies not configured (TWITTER_AUTH_TOKEN / TWITTER_CT0); skipping');
    return;
  }
  const { rows: sources } = await query(
    `SELECT * FROM sources WHERE type = 'twitter' AND active = true`
  );
  for (const s of sources) {
    try {
      const tweets = await fetchTimeline(s.identifier, 10);
      if (!tweets) continue;
      for (const t of tweets) {
        const text = (t.fullText || t.text || '').trim();
        if (!text) continue;
        const media = Array.isArray(t.media) ? t.media : [];
        const image = media.find(m => m.type === 'photo')?.url || null;
        const video = media.find(m => m.type === 'video' || m.type === 'animated_gif')?.url || null;
        const { tldr, read_time_min } = await summarize({ text, kind: 'tweet' });
        await insertAndNotify({
          source_id: s.id,
          external_id: String(t.id),
          title: null,
          author: `@${s.identifier}`,
          url: `https://twitter.com/${s.identifier}/status/${t.id}`,
          content_text: text,
          image_url: image,
          video_url: video,
          tldr,
          read_time_min,
          published_at: t.createdAt ? new Date(t.createdAt) : new Date(),
        });
      }
      console.log(`[twitter] @${s.identifier} ok (${tweets.length} tweets checked)`);
      // Friendly pacing — looks human, helps avoid rate limits.
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.warn(`[twitter] @${s.identifier} failed: ${e.message}`);
    }
  }
}
