// Polls all 'rss', 'website' and 'podcast' sources, summarizes each new item
// via the source owner's Gemini key, stores in D1. Runs on the */5 cron tick.
//
// Per-user fan-out: each user's sources are processed with that user's own
// credentials. RSS itself needs no key; the Gemini key (for TLDRs) and the
// YouTube key (for embedded-video runtimes) are read per user.

import { all, first } from '../lib/db.js';
import { parseFeed } from '../services/rssParse.js';
import { summarize } from '../services/summarizer.js';
import { totalEmbeddedYoutubeMin } from '../lib/youtubeDurations.js';
import { upsertPost } from './_common.js';
import { decryptOrNull } from '../lib/userCreds.js';
import { selectUserBatch, yieldTick } from '../lib/cronFanout.js';

export async function runRss(env) {
  const rows = await all(env,
    `SELECT DISTINCT user_id FROM sources
      WHERE type IN ('rss','website','podcast') AND active = 1`);
  const batch = await selectUserBatch(env, rows.map(r => r.user_id), 'rss');
  for (const uid of batch) {
    try {
      await runRssForUser(env, uid);
    } catch (e) {
      console.warn('[rss] user', uid, 'failed:', e.message);
    }
    await yieldTick();
  }
}

async function runRssForUser(env, userId) {
  const u = await first(env,
    `SELECT gemini_api_key_enc, yt_api_key_enc FROM users WHERE id = ?`, [userId]);
  const geminiApiKey = await decryptOrNull(env, u?.gemini_api_key_enc);
  const ytApiKey = await decryptOrNull(env, u?.yt_api_key_enc);

  const sources = await all(env,
    `SELECT * FROM sources
      WHERE user_id = ? AND type IN ('rss','website','podcast') AND active = 1`, [userId]);

  for (const s of sources) {
    const feedUrl = s.feed_url || s.identifier;
    if (!feedUrl) continue;
    try {
      const r = await fetch(feedUrl, {
        headers: { 'user-agent': 'Mindful/1.0 (+https://github.com/mindful)' },
        cf: { cacheTtl: 60 },
      });
      if (!r.ok) { console.warn('[rss]', feedUrl, r.status); continue; }
      const xml  = await r.text();
      const feed = parseFeed(xml);
      const items = feed.items.slice(0, Number(env.RSS_MAX_ITEMS || 20));
      for (const item of items) {
        if (!item.contentText && !item.title) continue;
        const kind = s.type === 'podcast' ? 'podcast episode' : 'article';
        const { tldr, read_time_min: textMin } = await summarize({
          title: item.title, text: item.contentText, kind, geminiApiKey,
        });
        // Blog posts that embed YouTube videos: add the video runtime to the
        // read-time (needs the user's YT key; no-ops to 0 without one).
        const embeddedVideoMin = s.type === 'website'
          ? await totalEmbeddedYoutubeMin(item.contentHtml, ytApiKey)
          : 0;
        const read_time_min = (textMin || 0) + embeddedVideoMin;
        await upsertPost(env, {
          source_id:    s.id,
          external_id:  item.guid || item.link || item.title,
          title:        item.title || null,
          author:       item.author || feed.title || null,
          url:          item.link || null,
          content_html: item.contentHtml,
          content_text: item.contentText,
          image_url:    item.image,
          tldr,
          read_time_min,
          published_at: item.date,
        });
      }
      console.log(`[rss] u${userId} ${s.identifier} ok (${items.length})`);
    } catch (e) {
      console.warn(`[rss] ${s.identifier} failed`, e.message);
    }
  }
}
