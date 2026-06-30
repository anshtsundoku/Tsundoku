// Minimal RSS/Atom parser. Cloudflare Workers don't include DOMParser, so
// we do a permissive regex-based parse — good enough for the feeds Mindful
// targets (blogs, newsletters, Nitter, YouTube RSS).
//
// Returns: { title, items: [{ guid, link, title, author, date, content, image }] }

function tag(xml, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : null;
}
function tagAttr(xml, name, attr) {
  const re = new RegExp(`<${name}[^>]*\\s${attr}="([^"]*)"[^>]*\\/?>`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : null;
}
import { stripHtml as cleanHtml, decodeEntities } from '../lib/textClean.js';

function unescapeXml(s) {
  if (!s) return s;
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
const stripHtml = cleanHtml;

// Feed bodies arrive in two shapes:
//   - REAL tags (RSS content:encoded, usually wrapped in CDATA) -> use as-is.
//   - ENTITY-ESCAPED tags (Atom <content type="html">, e.g. simonwillison.net)
//     where the markup is "&lt;p&gt;...&lt;/p&gt;" -> must be decoded ONCE so
//     we store renderable HTML, not literal "<p>" text.
// We only decode when there are NO real tags but there ARE escaped ones, so we
// never double-decode a feed that already gave us real HTML (which would mangle
// legitimately-escaped characters inside code blocks).
function decodeFeedHtml(raw) {
  if (!raw) return '';
  const hasRealTags = /<[a-zA-Z!/][^>]*>/.test(raw);
  if (hasRealTags) return raw;
  const hasEscapedTags = /&lt;\/?[a-zA-Z][\s\S]*?&gt;/.test(raw);
  if (hasEscapedTags) return decodeEntities(raw);
  return raw;
}

function pickItems(xml) {
  const out = [];
  // RSS <item>…</item>
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    out.push(parseItem(m[0], 'rss'));
  }
  if (out.length === 0) {
    // Atom <entry>…</entry>
    const entryRe = /<entry\b[\s\S]*?<\/entry>/gi;
    while ((m = entryRe.exec(xml)) !== null) {
      out.push(parseItem(m[0], 'atom'));
    }
  }
  return out;
}

function parseItem(xml, kind) {
  const title    = unescapeXml(tag(xml, 'title') || '').trim();
  const link     = unescapeXml(tag(xml, 'link') || tagAttr(xml, 'link', 'href') || '').trim();
  const guid     = unescapeXml(tag(xml, 'guid') || tag(xml, 'id') || link).trim();
  const author   = unescapeXml(tag(xml, 'author') || tag(xml, 'dc:creator') || tag(xml, 'creator') || '').trim();
  const dateRaw  = tag(xml, 'pubDate') || tag(xml, 'published') || tag(xml, 'updated') || tag(xml, 'dc:date');
  const date     = dateRaw ? new Date(dateRaw).toISOString() : null;
  const rawContent = unescapeXml(tag(xml, 'content:encoded') || tag(xml, 'content') || tag(xml, 'description') || tag(xml, 'summary') || '');
  const contentH = decodeFeedHtml(rawContent);
  const enclosureUrl = tagAttr(xml, 'enclosure', 'url');
  const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(contentH || '');
  const image    = enclosureUrl || (imgMatch && imgMatch[1]) || null;
  return {
    guid, link, title, author, date,
    contentHtml: contentH,
    contentText: stripHtml(contentH),
    image,
  };
}

export function parseFeed(xml) {
  const feedTitle = unescapeXml(tag(xml, 'title') || '').trim();
  return { title: feedTitle, items: pickItems(xml) };
}
