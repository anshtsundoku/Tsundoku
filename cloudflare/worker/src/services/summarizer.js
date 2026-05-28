// Gemini-based summarizer that runs inside Workers via fetch().
// Free tier: 1500 req/day, 1M tokens/day. Set GEMINI_API_KEY as a secret.

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = (k) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`;

const WPM = 220;

export function readTimeFor(text) {
  if (!text) return 1;
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / WPM));
}

// IMPORTANT: this fallback is only used when no API key is configured OR
// Gemini errors. It deliberately marks itself "(raw)" so you can tell at a
// glance that the AI didn't actually summarize — otherwise the symptom was
// "TLDR is just repeating the article" which is what happened when Gemini
// silently failed.
function fallback(text) {
  if (!text) return '';
  const s = text.replace(/\s+/g, ' ').trim();
  return '(raw) ' + (s.length > 180 ? s.slice(0, 177) + '…' : s);
}

async function callGemini(env, prompt, maxTokens = 220) {
  if (!env.GEMINI_API_KEY) {
    console.warn('[gemini] no API key configured');
    return null;
  }
  try {
    const r = await fetch(ENDPOINT(env.GEMINI_API_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
      }),
    });
    if (!r.ok) {
      console.warn('[gemini] http', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim() || null;
  } catch (e) {
    console.warn('[gemini] failed', e.message);
    return null;
  }
}

// New TLDR prompt (per v1.1 spec): a structured summary that covers ALL
// key/vital info in MINIMAL words — phrases are fine, complete sentences not
// required. The bullets keep things scannable.
const TLDR_PROMPT = (kind, title, text) =>
`Produce a structured TLDR for this ${kind}. Cover ALL key & vital info in minimal words. Phrases are fine — don't write full paragraphs.

Format: 2-4 short bullets, each a single phrase or clause. No preamble, no closing remarks, no headings. Just the bullets, one per line, each starting with "• ".

Be specific: names, numbers, claims, conclusions. Skip filler.

${title ? `Title: ${title}\n\n` : ''}Content:
${text.slice(0, 8000)}`;

export async function summarize(env, { title, text, kind = 'article' }) {
  const read_time_min = readTimeFor(text);
  if (!text) return { tldr: '', read_time_min };
  const tldr = (await callGemini(env, TLDR_PROMPT(kind, title, text), 280))
            || fallback(text);
  return { tldr, read_time_min };
}

export async function summarizeVideo(env, { title, transcript }) {
  const read_time_min = readTimeFor(transcript);
  if (!transcript) return { detailed: '', tldr: '', read_time_min };
  const prompt = `You are summarizing a YouTube video for someone who doesn't want to watch it. Produce TWO outputs separated by the line "---":

1. A detailed summary: 5-10 sentences, capturing the core argument, key claims, noteworthy specifics (numbers, names, examples).
2. A structured TLDR: 2-4 short bullets covering all key & vital info in minimal words. Each bullet on its own line starting with "• ". Phrases are fine — don't write paragraphs. Be specific.

No preamble, no headings.

Title: ${title || 'Untitled'}
Transcript:
${transcript.slice(0, 20000)}`;
  const raw = (await callGemini(env, prompt, 900)) || '';
  const [detailed, tldr] = raw.split(/---+/).map(s => (s || '').trim());
  return {
    detailed: detailed || fallback(transcript),
    tldr: tldr || fallback(transcript),
    read_time_min,
  };
}
