// Shared YouTube helpers — used by:
//   * ingest/youtube.js  → for the channel's own videos
//   * ingest/newsletter.js, ingest/rss.js → for videos EMBEDDED in HTML
//     content (newsletter / blog posts often embed a YT video; the read-time
//     should include that video's runtime, not just the text length).

const API = 'https://www.googleapis.com/youtube/v3';

// Pull every YouTube video ID we can spot in a chunk of HTML or plain text.
// Handles: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, ytimg
// thumbnails (i.ytimg.com/vi/ID/...). Returns a deduped array.
export function extractYoutubeIds(html) {
  if (!html) return [];
  const ids = new Set();
  const patterns = [
    /(?:^|[^a-zA-Z0-9_])(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    /(?:^|[^a-zA-Z0-9_])(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?[^"'\s<>]*?[?&]?v=([a-zA-Z0-9_-]{11})/g,
    /(?:^|[^a-zA-Z0-9_])(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
    /i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) ids.add(m[1]);
  }
  return [...ids];
}

// Batch contentDetails lookup — one API call per batch of up to 50 IDs,
// costs 1 quota unit regardless of batch size. Returns a map
// videoId → ISO-8601 duration string (e.g. "PT15M33S"). Silently returns
// {} if no API key is set so callers can fall through gracefully.
export async function fetchDurations(videoIds, apiKey) {
  if (!videoIds?.length || !apiKey) return {};
  const p = new URLSearchParams({
    part: 'contentDetails',
    id: videoIds.join(','),
    key: apiKey,
  });
  try {
    const r = await fetch(`${API}/videos?${p}`);
    if (!r.ok) {
      console.warn('[yt-durations] http', r.status);
      return {};
    }
    const data = await r.json();
    const out = {};
    for (const item of data?.items || []) {
      out[item.id] = item.contentDetails?.duration;
    }
    return out;
  } catch (e) {
    console.warn('[yt-durations] failed', e.message);
    return {};
  }
}

// "PT1H22M33S" → 83  (seconds round up to a 1-minute floor)
// "PT45S"      → 1
// "PT15M"      → 15
export function parseIsoDurationMin(iso) {
  if (!iso) return 0;
  const m = String(iso).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const hours   = Number(m[1] || 0);
  const minutes = Number(m[2] || 0);
  const seconds = Number(m[3] || 0);
  const total = hours * 60 + minutes + Math.round(seconds / 60);
  return Math.max(1, total);
}

// Convenience: given HTML, return the total runtime in minutes of every
// YouTube video referenced in it. Combines extract + fetch + sum.
export async function totalEmbeddedYoutubeMin(html, apiKey) {
  const ids = extractYoutubeIds(html);
  if (!ids.length) return 0;
  const durations = await fetchDurations(ids, apiKey);
  let total = 0;
  for (const id of ids) total += parseIsoDurationMin(durations[id]);
  return total;
}
