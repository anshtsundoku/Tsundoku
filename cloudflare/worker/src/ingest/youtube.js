// YouTube ingestion in a Worker:
//   1. List recent uploads via Data API v3 (free, 10k units/day quota).
//   2. Fetch contentDetails (durations) for the discovered videos.
//   3. Fetch the auto-caption transcript via YouTube's timedtext endpoint.
//   4. Summarize via Gemini.
//   5. Compute final read_time_min = summary-read-time + actual-video-length.

import { all } from '../lib/db.js';
import { summarizeVideo } from '../services/summarizer.js';
import { fetchDurations, parseIsoDurationMin } from '../lib/youtubeDurations.js';
import { upsertPost } from './_common.js';

const API = 'https://www.googleapis.com/youtube/v3';

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
    part: 'snippet',
    channelId,
    order: 'date',
    maxResults: String(max || 5),
    type: 'video',
    key: apiKey,
  });
  if (sinceIso) p.set('publishedAfter', sinceIso);
  const r = await fetch(`${API}/search?${p}`);
  const data = await r.json();
  return data?.items || [];
}

// Auto-caption transcript scrape — YouTube blocks server fetches sometimes;
// fall back to the description when it does.
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

export async function runYoutube(env) {
  if (!env.YOUTUBE_API_KEY) { console.warn('[youtube] YOUTUBE_API_KEY missing'); return; }
  const sources = await all(env, `SELECT * FROM sources WHERE type = 'youtube' AND active = 1`);
  for (const s of sources) {
    try {
      const cid = await resolveChannelId(s.identifier, env.YOUTUBE_API_KEY);
      if (!cid) continue;
      const since = s.last_polled_at;
      const vids = await recentVideos(cid, env.YOUTUBE_API_KEY, since, env.YOUTUBE_MAX_PER_CHANNEL);

      // Single batch call to grab durations for every video in this channel
      // tick, instead of one call per video.
      const videoIds = vids.map(v => v?.id?.videoId).filter(Boolean);
      const durations = await fetchDurations(videoIds, env.YOUTUBE_API_KEY);

      for (const v of vids) {
        const vid = v?.id?.videoId;
        if (!vid) continue;
        const transcript = await fetchTranscript(vid);
        const description = v.snippet?.description || '';
        const textForSummary = transcript || description;
        const { detailed, tldr, read_time_min: summaryMin } = await summarizeVideo(env, {
          title: v.snippet?.title,
          transcript: textForSummary,
          hasTranscript: Boolean(transcript),
        });
        // Total time to "consume" this post = time to read the summary +
        // actual video length. Both are minutes, both already floored at 1.
        const videoMin = parseIsoDurationMin(durations[vid]);
        const read_time_min = (summaryMin || 0) + videoMin;
        await upsertPost(env, {
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
      }
      console.log(`[youtube] ${s.identifier} ok (${vids.length})`);
    } catch (e) {
      console.warn(`[youtube] ${s.identifier} failed`, e.message);
    }
  }
}
