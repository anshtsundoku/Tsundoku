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
import { stripHtml as cleanHtml } from '../lib/textClean.js';

function unescapeXml(s) {
  if (!s) return s;
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
const stripHtml = cleanHtml;

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
  const contentH = unescapeXml(tag(xml, 'content:encoded') || tag(xml, 'content') || tag(xml, 'description') || tag(xml, 'summary') || '');
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
