// YouTube ingestion in a Worker, per user.
//
// If the user has set a YouTube Data API key (credential vault), we use the
// rich path: list uploads + durations + transcript, then summarize. If they
// haven't, we fall back to the channel's public RSS feed (no key required),
// which still yields new videos + descriptions to summarize — just without
// exact durations or transcripts.

import { all, first } from '../lib/db.js';
import { summarizeVideo } from '../services/summarizer.js';
import { fetchDurations, parseIsoDurationMin } from '../lib/youtubeDurations.js';
import { upsertPost, markSourceStatus, markSourceError } from './_common.js';
import { decryptOrNull } from '../lib/userCreds.js';
import { selectUserBatch, yieldTick } from '../lib/cronFanout.js';

const API = 'https://www.googleapis.com/youtube/v3';

export async function runYoutube(env) {
  // Users with any youtube source. (A user with a key but no youtube source has
  // nothing to poll, so source presence is the real gate.)
  const rows = await all(env,
    `SELECT DISTINCT user_id FROM sources WHERE type = 'youtube' AND active = 1`);
  const batch = await selectUserBatch(env, rows.map(r => r.user_id), 'youtube');
  for (const uid of batch) {
    try {
      await runYoutubeForUser(env, uid);
    } catch (e) {
      console.warn('[youtube] user', uid, 'failed:', e.message);
    }
    await yieldTick();
  }
}

async function runYoutubeForUser(env, userId) {
  const u = await first(env,
    `SELECT gemini_api_key_enc, yt_api_key_enc FROM users WHERE id = ?`, [userId]);
  const geminiApiKey = await decryptOrNull(env, u?.gemini_api_key_enc);
  const ytApiKey = await decryptOrNull(env, u?.yt_api_key_enc);

  const sources = await all(env,
    `SELECT * FROM sources WHERE user_id = ? AND type = 'youtube' AND active = 1
        AND (paused_until IS NULL OR paused_until <= datetime('now'))`, [userId]);

  for (const s of sources) {
    await ingestYoutubeSource(env, s, ytApiKey, geminiApiKey);
  }
}

// Ingest a single youtube source and record its health status. Returns the
// number of newly inserted posts.
async function ingestYoutubeSource(env, s, ytApiKey, geminiApiKey) {
  let inserted = 0;
  try {
    inserted = ytApiKey
      ? await ingestViaApi(env, s, ytApiKey, geminiApiKey)
      : await ingestViaRss(env, s, geminiApiKey);
    await markSourceStatus(env, s.id, inserted > 0);
  } catch (e) {
    console.warn(`[youtube] ${s.identifier} failed`, e.message);
    await markSourceError(env, s.id);
  }
  return inserted;
}

// Manual single-source ingest (POST /api/sources/:id/ingest-now).
export async function ingestYoutubeSourceNow(env, s) {
  const u = await first(env,
    `SELECT gemini_api_key_enc, yt_api_key_enc FROM users WHERE id = ?`, [s.user_id]);
  const geminiApiKey = await decryptOrNull(env, u?.gemini_api_key_enc);
  const ytApiKey = await decryptOrNull(env, u?.yt_api_key_enc);
  return ingestYoutubeSource(env, s, ytApiKey, geminiApiKey);
}

// ---------------------------------------------------------------------------
// API path (requires the user's YouTube Data API key)
// ---------------------------------------------------------------------------

async function resolveChannelId(identifier, apiKey) {
  if (identifier.startsWith('UC')) return identifier;
  const handle = identifier.replace(/^@/, '');
  const url = `${API}/channels?part=id&forHandle=@${encodeURIComponent(handle)}&key=${apiKey}`;
  const r = await fetch(url);
  const data = await r.json();
  return data?.items?.[0]?.id || null;
}

async function recentVideos(channelId, apiKey, sinceIso, max) {
  const p = new URLSearchParams({
    part: 'snippet', channelId, order: 'date',
    maxResults: String(max || 5), type: 'video', key: apiKey,
  });
  if (sinceIso) p.set('publishedAfter', sinceIso);
  const r = await fetch(`${API}/search?${p}`);
  const data = await r.json();
  return data?.items || [];
}

// Auto-caption transcript scrape — YouTube blocks server fetches sometimes;
// callers fall back to the description when this returns ''.
async function fetchTranscript(videoId) {
  try {
    const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Mindful)' },
    });
    const html = await watch.text();
    const m = /"captionTracks":(\[[^\]]+\])/.exec(html);
    if (!m) return '';
    const tracks = JSON.parse(m[1]);
    const en = tracks.find(t => /^en/i.test(t.languageCode)) || tracks[0];
    if (!en?.baseUrl) return '';
    const xml = await (await fetch(en.baseUrl)).text();
    return xml.replace(/<text[^>]*>([\s\S]*?)<\/text>/gi, '$1 ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();
  } catch (e) {
    console.warn('[youtube] transcript failed', videoId, e.message);
    return '';
  }
}

async function ingestViaApi(env, s, ytApiKey, geminiApiKey) {
  const cid = await resolveChannelId(s.identifier, ytApiKey);
  if (!cid) throw new Error(`could not resolve channel ${s.identifier}`);
  const vids = await recentVideos(cid, ytApiKey, s.last_polled_at, env.YOUTUBE_MAX_PER_CHANNEL);

  const videoIds = vids.map(v => v?.id?.videoId).filter(Boolean);
  const durations = await fetchDurations(videoIds, ytApiKey);

  let inserted = 0;
  for (const v of vids) {
    const vid = v?.id?.videoId;
    if (!vid) continue;
    const transcript = await fetchTranscript(vid);
    const description = v.snippet?.description || '';
    const textForSummary = transcript || description;
    const { detailed, tldr, read_time_min: summaryMin } = await summarizeVideo({
      title: v.snippet?.title, transcript: textForSummary,
      hasTranscript: Boolean(transcript), geminiApiKey,
    });
    const videoMin = parseIsoDurationMin(durations[vid]);
    const read_time_min = (summaryMin || 0) + videoMin;
    const post = await upsertPost(env, {
      source_id: s.id,
      external_id: vid,
      title: v.snippet?.title || null,
      author: v.snippet?.channelTitle || s.identifier,
      url: `https://www.youtube.com/watch?v=${vid}`,
      content_text: detailed,
      image_url: v.snippet?.thumbnails?.high?.url || null,
      video_url: `https://www.youtube.com/embed/${vid}`,
      tldr,
      read_time_min,
      published_at: v.snippet?.publishedAt || null,
    });
    if (post) inserted++;
  }
  console.log(`[youtube:api] ${s.identifier} ok (${vids.length}, ${inserted} new)`);
  return inserted;
}

// ---------------------------------------------------------------------------
// Keyless RSS path (no API key) — channel uploads feed.
// ---------------------------------------------------------------------------

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Resolve a @handle (or custom URL) to a UC… channel id without an API key by
// scraping the channel page. UC ids pass through untouched.
async function resolveChannelIdKeyless(identifier) {
  if (identifier.startsWith('UC')) return identifier;
  const handle = identifier.replace(/^@/, '');
  try {
    const r = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Mindful)' },
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = /"(?:externalId|channelId)":"(UC[\w-]+)"/.exec(html)
           || /channel\/(UC[\w-]+)/.exec(html);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Minimal parser for the YouTube channel Atom feed.
function parseYoutubeFeed(xml) {
  const out = [];
  const blocks = String(xml).split(/<entry>/).slice(1);
  for (const b of blocks) {
    const vid       = (/<yt:videoId>([^<]+)<\/yt:videoId>/.exec(b) || [])[1];
    const title     = decodeXml((/<title>([\s\S]*?)<\/title>/.exec(b) || [])[1] || '');
    const published = (/<published>([^<]+)<\/published>/.exec(b) || [])[1];
    const desc      = decodeXml((/<media:description>([\s\S]*?)<\/media:description>/.exec(b) || [])[1] || '');
    const thumb     = (/<media:thumbnail[^>]*url="([^"]+)"/.exec(b) || [])[1];
    const author    = decodeXml((/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(b) || [])[1] || '');
    if (vid) out.push({ vid, title, published, desc, thumb, author });
  }
  return out;
}

async function ingestViaRss(env, s, geminiApiKey) {
  const cid = await resolveChannelIdKeyless(s.identifier);
  if (!cid) throw new Error(`cannot resolve channel ${s.identifier}`);
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, {
    headers: { 'user-agent': 'Mindful/1.0' },
  });
  if (!r.ok) throw new Error(`youtube rss ${r.status}`);
  const entries = parseYoutubeFeed(await r.text())
    .slice(0, Number(env.YOUTUBE_MAX_PER_CHANNEL || 5));

  let inserted = 0;
  for (const v of entries) {
    // No transcript/durations on the keyless path — summarize the description.
    const { detailed, tldr, read_time_min } = await summarizeVideo({
      title: v.title, transcript: v.desc, hasTranscript: false, geminiApiKey,
    });
    const post = await upsertPost(env, {
      source_id: s.id,
      external_id: v.vid,
      title: v.title || null,
      author: v.author || s.identifier,
      url: `https://www.youtube.com/watch?v=${v.vid}`,
      content_text: detailed || v.desc || null,
      image_url: v.thumb || `https://i.ytimg.com/vi/${v.vid}/hqdefault.jpg`,
      video_url: `https://www.youtube.com/embed/${v.vid}`,
      tldr,
      read_time_min,
      published_at: v.published || null,
    });
    if (post) inserted++;
  }
  console.log(`[youtube:rss] ${s.identifier} ok (${entries.length}, ${inserted} new)`);
  return inserted;
}
