// Polls YouTube channels using the YouTube Data API v3, fetches transcripts,
// and produces detailed AI summaries.
//
// Source.identifier for type='youtube' is either:
//   - a channel ID starting with "UC..."
//   - or the channel's @handle
import { YoutubeTranscript } from 'youtube-transcript';
import { query } from '../db/index.js';
import { insertAndNotify } from '../services/publisher.js';
import { summarizeVideo } from '../services/summarizer.js';

const API = 'https://www.googleapis.com/youtube/v3';

async function resolveChannelId(identifier, apiKey) {
  if (identifier.startsWith('UC')) return identifier;
  // For @handles, use the channels endpoint with forHandle (only on newer API)
  const handle = identifier.replace(/^@/, '');
  const url = `${API}/channels?part=id&forHandle=@${encodeURIComponent(handle)}&key=${apiKey}`;
  const r = await fetch(url);
  const data = await r.json();
  return data.items?.[0]?.id || null;
}

async function fetchLatestVideos(channelId, apiKey, sinceIso) {
  // Use search endpoint; cheap-ish and supports publishedAfter.
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    order: 'date',
    maxResults: '10',
    type: 'video',
    key: apiKey,
  });
  if (sinceIso) params.set('publishedAfter', sinceIso);
  const r = await fetch(`${API}/search?${params}`);
  const data = await r.json();
  return data.items || [];
}

async function fetchTranscript(videoId) {
  try {
    const segs = await YoutubeTranscript.fetchTranscript(videoId);
    return segs.map(s => s.text).join(' ');
  } catch (e) {
    console.warn(`[youtube] no transcript for ${videoId}: ${e.message}`);
    return '';
  }
}

export async function runYoutubeOnce() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set; skipping');
    return;
  }
  const { rows: sources } = await query(
    `SELECT * FROM sources WHERE type = 'youtube' AND active = true`
  );
  for (const s of sources) {
    try {
      const channelId = await resolveChannelId(s.identifier, apiKey);
      if (!channelId) {
        console.warn(`[youtube] could not resolve ${s.identifier}`);
        continue;
      }
      const since = s.last_polled_at ? new Date(s.last_polled_at).toISOString() : null;
      const videos = await fetchLatestVideos(channelId, apiKey, since);
      for (const v of videos) {
        const videoId = v.id?.videoId;
        if (!videoId) continue;
        const transcript = await fetchTranscript(videoId);
        const { detailed, tldr, read_time_min } = await summarizeVideo({
          title: v.snippet?.title, transcript,
        });
        await insertAndNotify({
          source_id: s.id,
          external_id: videoId,
          title: v.snippet?.title || null,
          author: v.snippet?.channelTitle || s.identifier,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          content_text: detailed,
          image_url: v.snippet?.thumbnails?.high?.url || null,
          video_url: `https://www.youtube.com/embed/${videoId}`,
          tldr,
          read_time_min,
          published_at: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : new Date(),
        });
      }
      console.log(`[youtube] ${s.identifier} ok (${videos.length} videos checked)`);
    } catch (e) {
      console.warn(`[youtube] ${s.identifier} failed: ${e.message}`);
    }
  }
}
