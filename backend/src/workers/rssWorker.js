// Polls all sources of type 'rss' and 'website' (RSS-discoverable websites).
// Newsletter and Twitter sources are routed through their own RSS-like
// pipelines (IMAP and Nitter respectively).
import Parser from 'rss-parser';
import { query } from '../db/index.js';
import { insertAndNotify } from '../services/publisher.js';
import { summarize } from '../services/summarizer.js';

const parser = new Parser({ timeout: 15000 });

function stripHtml(html = '') {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

function firstImage(item) {
  if (item.enclosure?.url && /^image\//.test(item.enclosure.type || '')) return item.enclosure.url;
  const html = item['content:encoded'] || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export async function runRssOnce() {
  const { rows: sources } = await query(
    `SELECT * FROM sources WHERE type IN ('rss','website') AND active = true`
  );
  for (const s of sources) {
    // For website sources, feed_url holds the auto-discovered RSS URL.
    // For 'rss' sources, identifier IS the feed URL.
    const url = s.feed_url || s.identifier;
    if (!url) {
      console.warn(`[rss] no feed url for source ${s.id} (${s.identifier}) — skipping`);
      continue;
    }
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
        const text = stripHtml(item['content:encoded'] || item.content || item.contentSnippet || '');
        if (!text && !item.title) continue;
        const { tldr, read_time_min } = await summarize({
          title: item.title, text, kind: 'article',
        });
        await insertAndNotify({
          source_id: s.id,
          external_id: item.guid || item.link || item.title,
          title: item.title || null,
          author: item.creator || feed.title || null,
          url: item.link || null,
          content_text: text,
          content_html: item['content:encoded'] || item.content || null,
          image_url: firstImage(item),
          tldr,
          read_time_min,
          published_at: item.isoDate ? new Date(item.isoDate) : new Date(),
        });
      }
      console.log(`[rss] ${s.identifier} ok (${feed.items?.length || 0} items checked)`);
    } catch (e) {
      console.warn(`[rss] ${s.identifier} (feed=${url}) failed: ${e.message}`);
    }
  }
}
