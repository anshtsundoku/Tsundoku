// Shared text-cleaning helpers for ingest pipelines.
//
// Incoming HTML (newsletters, RSS, web pages) contains HTML entities
// (&#8217;, &nbsp;, &amp;) AND invisible Unicode tracker characters
// (zero-width spaces, combining grapheme joiners, soft hyphens — a common
// email fingerprinting tactic). If we only strip tags and leave those
// alone, the text sent to Gemini becomes garbage; Gemini quietly fails
// and we fall back to "(raw) ..." — the symptom on the newsletter card.
//
// stripHtml is the one-stop function: strip tags, decode entities, remove
// invisible chars, normalize whitespace. Use this everywhere HTML -> text.

const NAMED_ENTITIES = {
  nbsp:   ' ',
  amp:    '&', lt: '<', gt: '>',
  quot:   '"', apos: "'",
  hellip: '…',
  mdash:  '—', ndash: '–',
  rsquo:  '’', lsquo: '‘',
  rdquo:  '”', ldquo: '“',
  laquo:  '«', raquo: '»',
  copy:   '©', reg:   '®', trade: '™',
  bull:   '•', middot:'·',
  rarr:   '→', larr:  '←', uarr: '↑', darr: '↓',
  cent:   '¢', pound: '£', euro: '€', yen:  '¥',
};

export function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g,
      (m, name) => Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
                     ? NAMED_ENTITIES[name] : m)
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ''; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    });
}

// Strip invisible / tracker characters. Built via `new RegExp()` from
// ASCII-only string literals containing \u escapes — keeps this file
// readable and avoids hidden chars in source.
//
//   U+00AD   soft hyphen
//   U+034F   combining grapheme joiner (a common email tracker)
//   U+061C   Arabic letter mark
//   U+180E   Mongolian vowel separator
//   U+200B–F ZWSP, ZWNJ, ZWJ, LRM, RLM
//   U+202A–E directional formatting (LRE, RLE, PDF, LRO, RLO)
//   U+2060–F word joiner, invisible math operators, et al.
//   U+FEFF   BOM / zero-width no-break space
const INVISIBLE_RE = new RegExp(
  '[­͏؜᠎​-‏‪-‮⁠-⁯﻿]',
  'g'
);

// Unicode space variants → regular space
//   U+00A0    no-break space
//   U+2000–A  en quad through hair space
//   U+202F    narrow no-break space
//   U+205F    medium math space
//   U+3000    ideographic space
const UNICODE_SPACES_RE = new RegExp('[  -   　]', 'g');

// Line / paragraph separators → newline
//   U+2028 line separator
//   U+2029 paragraph separator
const UNICODE_NEWLINES_RE = new RegExp('[  ]', 'g');

export function stripInvisible(s) {
  if (!s) return '';
  return s
    .replace(INVISIBLE_RE, '')
    .replace(UNICODE_SPACES_RE, ' ')
    .replace(UNICODE_NEWLINES_RE, '\n');
}

// One-stop HTML -> clean plain text.
export function stripHtml(html) {
  if (!html) return '';
  // 1) Drop scripts/styles entirely (their content isn't readable text).
  // 2) Turn block boundaries into newlines BEFORE deleting tags, so the
  //    paragraph structure survives.
  // 3) Remove all remaining tags.
  // 4) Decode entities, strip invisibles, normalize whitespace.
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre|article|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = stripInvisible(s);
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
