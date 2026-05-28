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

function fallback(text) {
  if (!text) return '';
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > 180 ? s.slice(0, 177) + '...' : s;
}

async function callGemini(env, prompt, maxTokens = 200) {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const r = await fetch(ENDPOINT(env.GEMINI_API_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
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

export async function summarize(env, { title, text, kind = 'article' }) {
  const read_time_min = readTimeFor(text);
  if (!text) return { tldr: fallback(text), read_time_min };
  const prompt = `You are summarizing a ${kind} for a busy reader who wants the gist in 2 lines.
Write a TLDR in at most 2 sentences, under 220 characters total.
Be specific (names, numbers, claims). No preamble like "This article".
${title ? `Title: ${title}\n` : ''}Content:
${text.slice(0, 8000)}`;
  const tldr = (await callGemini(env, prompt, 200)) || fallback(text);
  return { tldr, read_time_min };
}

export async function summarizeVideo(env, { title, transcript }) {
  const read_time_min = readTimeFor(transcript);
  if (!transcript) return { detailed: '', tldr: '', read_time_min };
  const prompt = `You are summarizing a YouTube video for someone who doesn't want to watch it.
Produce two outputs separated by the line "---":

1. A detailed summary (5-10 sentences) capturing the core argument, key claims, and any noteworthy specifics (numbers, names, examples).
2. A one-sentence TLDR under 180 characters.

Title: ${title || 'Untitled'}
Transcript:
${transcript.slice(0, 20000)}`;
  const raw = (await callGemini(env, prompt, 800)) || '';
  const [detailed, tldr] = raw.split(/---+/).map(s => (s || '').trim());
  return {
    detailed: detailed || fallback(transcript),
    tldr: tldr || fallback(transcript),
    read_time_min,
  };
}
