// Given a website URL, find its RSS/Atom feed via the head <link> tag or
// common feed paths. fetch-based, runs fine in Workers.

const COMMON_PATHS = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml', '/feed/', '/rss/'];

function normalize(input) {
  let u = (input || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const url = new URL(u); url.hash = ''; return url; } catch { return null; }
}

function absoluteUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); } catch { return null; }
}

function findFeedInHtml(html, base) {
  const re = /<link\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const a = m[1];
    if (!/rel=["']?alternate/i.test(a)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(a)) continue;
    const hm = /href=["']([^"']+)["']/i.exec(a);
    if (hm) return absoluteUrl(hm[1], base);
  }
  return null;
}

async function looksLikeFeed(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'MindfulFeedDiscovery/1.0' } });
    if (!r.ok) return false;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) return true;
    const text = (await r.text()).slice(0, 4000).toLowerCase();
    return text.includes('<rss') || text.includes('<feed') || text.includes('<?xml');
  } catch { return false; }
}

export async function discoverFeed(rawUrl) {
  const url = normalize(rawUrl);
  if (!url) return null;
  const base = url.toString();

  if (await looksLikeFeed(base)) return base;

  try {
    const r = await fetch(base, { headers: { 'user-agent': 'MindfulFeedDiscovery/1.0' } });
    if (r.ok) {
      const html = await r.text();
      const link = findFeedInHtml(html, base);
      if (link && await looksLikeFeed(link)) return link;
    }
  } catch (e) {
    console.warn('[discover] head fetch failed', e.message);
  }

  const origin = `${url.protocol}//${url.host}`;
  for (const path of COMMON_PATHS) {
    const c = origin + path;
    if (await looksLikeFeed(c)) return c;
  }

  return null;
}
