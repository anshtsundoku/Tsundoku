// Given a website URL, find its RSS/Atom feed.
//
// Strategy:
// 1. Fetch the HTML and look for <link rel="alternate" type="application/rss+xml" href="...">
//    or "application/atom+xml". This is the standard way blogs advertise feeds.
// 2. If none, probe common feed paths: /feed, /rss, /feed.xml, /rss.xml,
//    /atom.xml, /index.xml.
// 3. Validate that the candidate URL returns parseable XML (rss-parser).
//
// Returns the resolved feed URL or null.

import Parser from 'rss-parser';

const parser = new Parser({ timeout: 10000 });

const COMMON_PATHS = [
  '/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml',
  '/feed/', '/rss/', '/feed.atom',
];

function normalizeUrl(input) {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const url = new URL(u);
    url.hash = '';
    return url;
  } catch { return null; }
}

function absoluteUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); } catch { return null; }
}

function findFeedLinkInHtml(html, baseUrl) {
  // Find <link ...> tags advertising feeds.
  const re = /<link\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    if (!/rel=["']?alternate/i.test(attrs)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(attrs)) continue;
    const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs);
    if (hrefMatch) return absoluteUrl(hrefMatch[1], baseUrl);
  }
  return null;
}

async function tryParseFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    if (feed && (feed.items || feed.title)) return true;
  } catch { /* not a feed */ }
  return false;
}

export async function discoverFeed(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  const base = url.toString();

  // 1) Try the URL itself in case the user already pasted a feed.
  if (await tryParseFeed(base)) return base;

  // 2) Look inside the HTML.
  try {
    const r = await fetch(base, {
      headers: { 'user-agent': 'MindfulFeedDiscovery/1.0' },
      redirect: 'follow',
    });
    if (r.ok) {
      const html = await r.text();
      const link = findFeedLinkInHtml(html, base);
      if (link && await tryParseFeed(link)) return link;
    }
  } catch (e) {
    console.warn('[discover] fetch failed for', base, e.message);
  }

  // 3) Probe common paths on the origin.
  const origin = `${url.protocol}//${url.host}`;
  for (const path of COMMON_PATHS) {
    const candidate = origin + path;
    if (await tryParseFeed(candidate)) return candidate;
  }

  return null;
}
