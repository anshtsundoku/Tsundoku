// AI summarization via Google Gemini.
//
// Reliability principles for v2:
//   1. NEVER disguise an AI failure as a bad summary. If Gemini didn't
//      produce a usable output, summarize() returns `tldr: null` — the
//      frontend then shows nothing (or an explicit "unavailable" affordance).
//      No more "(raw) ..." pretending to be a real summary.
//   2. Probe across known-good model names. Google renames Gemini models
//      every few months; we try a list in order and memoize the winner.
//   3. Retry transient failures (429 rate-limit, 5xx) with exponential
//      back-off. Don't retry 4xx errors except 429.
//   4. Log enough that "why did this fail?" is answerable from wrangler tail.

const MODELS_FALLBACK_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const WPM = 220;

// Memoised once we've found a model that works on this account.
let _workingModel = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function readTimeFor(text) {
  if (!text) return 1;
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / WPM));
}

// Returns { ok: true, text, model } on success, { ok: false, reason, status?, body? } otherwise.
async function callGemini(env, prompt, maxTokens = 280) {
  if (!env.GEMINI_API_KEY) {
    return { ok: false, reason: 'no_key' };
  }

  // Try the memoised model first; fall through to the rest only if the
  // memoised one starts failing (e.g. Google deprecates it).
  const order = _workingModel
    ? [_workingModel, ...MODELS_FALLBACK_CHAIN.filter(m => m !== _workingModel)]
    : [...MODELS_FALLBACK_CHAIN];

  let lastErr = { reason: 'no_attempt' };

  for (const model of order) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(ENDPOINT(model, env.GEMINI_API_KEY), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
          }),
        });

        if (r.ok) {
          const data = await r.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            _workingModel = model;
            return { ok: true, text: text.trim(), model };
          }
          // Empty body — usually safety-block (no `text` field). Surface the
          // finishReason in logs so we can tell *why* the model bailed.
          const reason = data?.candidates?.[0]?.finishReason || 'unknown';
          console.warn(`[gemini] ${model} empty response (finishReason=${reason})`);
          lastErr = { reason: 'empty_response', finish: reason };
          break; // don't retry empty
        }

        const body = await r.text().catch(() => '');
        console.warn(`[gemini] ${model} http ${r.status}: ${body.slice(0, 240)}`);
        lastErr = { reason: 'http', status: r.status, body: body.slice(0, 240) };

        if (r.status === 404 || r.status === 400) break;   // bad model / bad request — try next model
        if (r.status === 401 || r.status === 403) return lastErr; // bad key — fail fast, stop trying

        // 429 / 5xx → backoff & retry on same model
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }
        break;
      } catch (e) {
        console.warn(`[gemini] ${model} network err:`, e.message);
        lastErr = { reason: 'network', error: e.message };
        if (attempt < 2) {
          await sleep(300 * Math.pow(2, attempt));
          continue;
        }
      }
    }
  }
  return { ok: false, ...lastErr };
}

const TLDR_PROMPT = (kind, title, text) =>
`Produce a structured TLDR for this ${kind}. Cover all key & vital info in minimal words.

Format: 2-4 short bullets, each a single phrase or clause. One per line, each starting with "• ". No preamble, no closing remarks, no headings. Phrases are fine — don't write paragraphs.

Be specific: names, numbers, claims, conclusions. Skip filler.

${title ? `Title: ${title}\n\n` : ''}Content:
${text.slice(0, 8000)}`;

export async function summarize(env, { title, text, kind = 'article' }) {
  const read_time_min = readTimeFor(text);
  if (!text) return { tldr: null, read_time_min };

  const result = await callGemini(env, TLDR_PROMPT(kind, title, text), 320);
  return {
    tldr: result.ok ? result.text : null,   // explicit null on failure
    read_time_min,
  };
}

export async function summarizeVideo(env, { title, transcript, hasTranscript = true }) {
  if (!transcript) {
    // Title-only fallback
    if (title) {
      const r = await callGemini(env, TLDR_PROMPT('video', title, title), 200);
      return { detailed: '', tldr: r.ok ? r.text : null, read_time_min: 1 };
    }
    return { detailed: '', tldr: null, read_time_min: 1 };
  }

  const sourceLabel = hasTranscript ? 'transcript' : 'description (transcript unavailable)';
  const prompt = `You are summarizing a YouTube video. Below is the ${sourceLabel}. Produce TWO outputs separated by the line "---":

1. A detailed summary: 5-10 sentences capturing the core argument, key claims, noteworthy specifics. ${hasTranscript ? '' : 'Note: based on the description only — be cautious about claims you cannot verify.'}
2. A structured TLDR: 2-4 short bullets covering all key & vital info in minimal words. Each bullet on its own line starting with "• ". Phrases are fine — don't write paragraphs.

No preamble, no headings.

Title: ${title || 'Untitled'}

${sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1)}:
${transcript.slice(0, 20000)}`;

  const r = await callGemini(env, prompt, 900);
  if (!r.ok) {
    return { detailed: null, tldr: null, read_time_min: readTimeFor(transcript) };
  }
  const [detailed, tldr] = r.text.split(/---+/).map(s => (s || '').trim());
  const finalDetailed = detailed || null;
  return {
    detailed: finalDetailed,
    tldr: tldr || null,
    read_time_min: readTimeFor(finalDetailed || ''),
  };
}

// Exposed for /api/admin/gemini-test — pings Gemini with a trivial prompt
// and reports which model responded (or what went wrong).
export async function geminiHealth(env) {
  const r = await callGemini(env, 'Reply with the single word "ok".', 16);
  return r;
}
