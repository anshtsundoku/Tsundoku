// Polls all 'rss' and 'website' sources, summarizes each new item via Gemini,
// stores in D1. Runs on the */5 cron tick.

import { all } from '../lib/db.js';
import { parseFeed } from '../services/rssParse.js';
import { summarize } from '../services/summarizer.js';
import { upsertPost } from './_common.js';

export async function runRss(env) {
  // RSS worker handles all the RSS-backed source types: explicit 'rss',
  // 'website' (with discovered feed), and 'podcast' (Spotify/Apple/etc.
  // all expose RSS for non-exclusive shows).
  const sources = await all(env,
    `SELECT * FROM sources WHERE type IN ('rss','website','podcast') AND active = 1`
  );
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
        const kind = s.type === 'podcast' ? 'podcast episode'
                  : s.type === 'website' ? 'article' : 'article';
      const { tldr, read_time_min } = await summarize(env, {
          title: item.title, text: item.contentText, kind,
        });
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
      console.log(`[rss] ${s.identifier} ok (${items.length})`);
    } catch (e) {
      console.warn(`[rss] ${s.identifier} failed`, e.message);
    }
  }
}
