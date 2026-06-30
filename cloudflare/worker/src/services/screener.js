// Article screener — strips ads / boilerplate from scraped blog content and
// keeps the real article text, verbatim.
//
// Design principles:
//   1. Deterministic first. A heuristic pass removes the obvious cruft
//      (ad/promo/share/related/cookie containers, "Advertisement" lines)
//      with zero token cost and zero hallucination risk.
//   2. Verbatim only. We NEVER let the model rewrite the article. When a
//      Gemini key is present, the model is asked only to *identify* ad /
//      boilerplate snippets that appear verbatim in the text; we then delete
//      those exact substrings. The surviving article text is the author's
//      own words, untouched.
//   3. Safety valves. If a removal would delete too much of the body, we skip
//      it — better to keep a stray ad than to gut a real article.

import { stripHtml } from '../lib/textClean.js';
import { callGemini } from './summarizer.js';

// Block-level elements whose class/id smells like non-article furniture.
const BAD_WORD =
  'ad|ads|advert|advertis|sponsor|promo|promotion|newsletter|subscribe|' +
  'signup|sign-up|share|social|related|recirc|recommend|outbrain|taboola|' +
  'cookie|consent|gdpr|paywall|popup|modal|overlay|banner|widget|comment|' +
  'disqus|sidebar|breadcrumb|pagination|author-bio|byline-social|' +
  'more-stories|read-more|trending|nav-|site-header|site-footer';

const BLOCK_TAGS = 'div|section|aside|figure|ul|ol|nav|header|footer|form|p|span|a';

// Remove whole elements whose opening tag carries a smelly class or id. This
// is a best-effort regex strip (HTML isn't regular), so we run a few passes to
// catch siblings and shallow nesting, and we always run the deterministic
// text-line filter afterwards as a backstop.
function stripBoilerplateHtml(html) {
  if (!html) return '';
  let s = html
    .replace(/<(script|style|noscript|svg|form|template|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Neutralize the two HTML-borne JS execution vectors (defense in depth;
    // the body is later injected via dangerouslySetInnerHTML).
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"');

  // Match a bad word only at the START of a class/id token (right after the
  // opening quote, or after a space/_/-). This avoids gutting real content
  // whose class merely CONTAINS a bad substring, e.g. "post-header" (has "ad"),
  // "reading-list" (has "read"), "shadow-box" (has "ad").
  const re = new RegExp(
    `<(${BLOCK_TAGS})\\b[^>]*\\b(?:class|id|role|aria-label)\\s*=\\s*["'](?:[^"']*?[\\s_-])?(?:${BAD_WORD})[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    'gi'
  );
  for (let i = 0; i < 3; i++) {
    const next = s.replace(re, '');
    if (next === s) break;
    s = next;
  }
  // <aside> is almost always furniture; drop any that survived.
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '');
  return s;
}

// Lines that are pure boilerplate when they stand alone. Matched against a
// trimmed, lowercased line; we keep everything else verbatim.
const AD_LINE_RE = new RegExp(
  '^(' +
    'advertisement|sponsored|sponsored content|paid post|' +
    'continue reading( below)?|read more|read next|keep reading|' +
    'share this( (article|story|post))?|share on (twitter|facebook|linkedin)|' +
    'subscribe( now| to .*)?|sign up( for .*)?|join our newsletter|' +
    'follow us( on .*)?|related (stories|posts|articles|reading)|' +
    'you might also like|more from|recommended for you|' +
    'view comments|leave a comment|comments \\(\\d+\\)|' +
    'this (article|story) (was|first) (originally )?(published|appeared)|' +
    'we use cookies|accept (all )?cookies|cookie (policy|settings)|' +
    'enable javascript|please disable your ad ?blocker' +
  ')\\b'
);

function stripBoilerplateText(text) {
  if (!text) return '';
  const kept = text.split('\n').filter((line) => {
    const t = line.trim().toLowerCase();
    if (!t) return true; // keep blanks so paragraph structure survives
    if (AD_LINE_RE.test(t)) return false;
    return true;
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const AD_DETECT_PROMPT = (text) =>
`The text below was scraped from a blog or news article. Mixed into the real article body there may be: advertisements, sponsorship blurbs, newsletter/subscribe prompts, "share this" / social lines, "related articles" lists, cookie/consent notices, navigation labels, and other boilerplate.

Return ONLY a JSON array of strings. Each string must be an EXACT, VERBATIM substring of the text above (copied character-for-character) that is NOT part of the actual article and should be removed. Do NOT paraphrase. Do NOT include real article sentences. If nothing should be removed, return [].

TEXT:
${text.slice(0, 9000)}`;

// Ask the model which verbatim snippets are non-article cruft, then delete
// those exact substrings. Returns the cleaned text (or the input unchanged on
// any failure). Never rewrites — only removes.
async function geminiStripAds(text, geminiApiKey) {
  const r = await callGemini(geminiApiKey, AD_DETECT_PROMPT(text), 700);
  if (!r.ok) return text;

  let snippets;
  try {
    const jsonStart = r.text.indexOf('[');
    const jsonEnd = r.text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) return text;
    snippets = JSON.parse(r.text.slice(jsonStart, jsonEnd + 1));
  } catch {
    return text;
  }
  if (!Array.isArray(snippets) || snippets.length === 0) return text;

  let out = text;
  for (const raw of snippets) {
    const snip = String(raw || '').trim();
    // Skip junk / too-short snippets and anything implausibly large.
    if (snip.length < 12) continue;
    if (snip.length > out.length * 0.5) continue;
    if (!out.includes(snip)) continue;
    const candidate = out.split(snip).join('\n');
    // Safety valve: never let one removal gut the article.
    if (candidate.replace(/\s/g, '').length < out.replace(/\s/g, '').length * 0.4) continue;
    out = candidate;
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// Public entry point. Given a raw item's html/text, return cleaned
// { content_text, content_html }. `geminiApiKey` is optional — without it we
// do the deterministic pass only.
export async function screenContent({ html, text, geminiApiKey } = {}) {
  let cleanedHtml = '';
  try {
    cleanedHtml = html ? stripBoilerplateHtml(html) : '';
    // Safety valve: if the strip removed most of the body, it almost certainly
    // ate real content. Keep the original rather than ship a gutted article.
    if (html && cleanedHtml.replace(/\s/g, '').length < html.replace(/\s/g, '').length * 0.4) {
      cleanedHtml = html;
    }
  } catch (e) {
    console.warn('[screener] html strip failed:', e.message);
    cleanedHtml = html || '';
  }

  // content_text is ALWAYS clean plain text derived from the renderable HTML
  // (or the provided text). Raw HTML must never land in content_text.
  let cleanedText = cleanedHtml ? stripHtml(cleanedHtml) : (text || '');
  cleanedText = stripBoilerplateText(cleanedText);

  // Only spend a model call when there's enough text to be worth screening.
  // The model only trims the plain-text copy (for the summarizer/storage); the
  // renderable content_html is never sent to or rewritten by the model.
  if (geminiApiKey && cleanedText && cleanedText.length > 600) {
    try {
      cleanedText = await geminiStripAds(cleanedText, geminiApiKey);
    } catch (e) {
      console.warn('[screener] gemini strip failed:', e.message);
    }
  }

  return {
    content_text: cleanedText || text || null,
    content_html: cleanedHtml || html || null,
  };
}
