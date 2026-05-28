// AI summarization helper. Returns { tldr, read_time_min }.
//
// Uses Google Gemini's free tier (1500 requests/day, 1M tokens/day).
// If no API key is configured the summarizer transparently falls back to
// a deterministic excerpt + word-count read-time, so the app still works.

import { GoogleGenerativeAI } from '@google/generative-ai';

const WORDS_PER_MIN = 220;

function readTimeFor(text) {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MIN));
}

function fallbackTldr(text) {
  if (!text) return '';
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 180 ? oneLine.slice(0, 177) + '...' : oneLine;
}

let client = null;
function getModel(modelName = 'gemini-2.0-flash') {
  if (client) return client.getGenerativeModel({ model: modelName });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  client = new GoogleGenerativeAI(key);
  return client.getGenerativeModel({ model: modelName });
}

export async function summarize({ title, text, kind = 'article' }) {
  const read_time_min = readTimeFor(text);
  const model = getModel('gemini-2.0-flash');
  if (!model || !text) {
    return { tldr: fallbackTldr(text), read_time_min };
  }

  const prompt = `You are summarizing a ${kind} for a busy reader who wants the gist in 2 lines.
Write a TLDR in at most 2 sentences, under 220 characters total.
Be specific (names, numbers, claims). No preamble like "This article".
${title ? `Title: ${title}\n` : ''}Content:
${text.slice(0, 8000)}`;

  try {
    const result = await model.generateContent(prompt);
    const tldr = result.response.text().trim() || fallbackTldr(text);
    return { tldr, read_time_min };
  } catch (e) {
    console.warn('[summarizer] gemini failed, using fallback', e.message);
    return { tldr: fallbackTldr(text), read_time_min };
  }
}

// Detailed YouTube summary: longer, structured.
export async function summarizeVideo({ title, transcript }) {
  const read_time_min = readTimeFor(transcript);
  const model = getModel('gemini-2.0-flash');
  if (!model || !transcript) {
    return { detailed: fallbackTldr(transcript), tldr: fallbackTldr(transcript), read_time_min };
  }

  const prompt = `You are summarizing a YouTube video for someone who doesn't want to watch it.
Produce two outputs separated by the line "---":

1. A detailed summary (5-10 sentences) capturing the core argument, key claims, and any noteworthy specifics (numbers, names, examples).
2. A one-sentence TLDR under 180 characters.

Title: ${title || 'Untitled'}
Transcript:
${transcript.slice(0, 20000)}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text() || '';
    const [detailed, tldr] = raw.split(/---+/).map(s => s.trim());
    return {
      detailed: detailed || fallbackTldr(transcript),
      tldr: tldr || fallbackTldr(transcript),
      read_time_min,
    };
  } catch (e) {
    console.warn('[summarizer] video summary failed', e.message);
    return { detailed: fallbackTldr(transcript), tldr: fallbackTldr(transcript), read_time_min };
  }
}
