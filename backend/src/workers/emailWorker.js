// Newsletter ingestion via IMAP IDLE. As soon as a new email lands in the
// dedicated newsletter inbox we ingest it.
//
// Match strategy: any incoming email whose From-address matches a source of
// type 'newsletter' is ingested under that source. The Source.identifier is
// the sender's email address (e.g. "newsletter@stratechery.com").
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { query } from '../db/index.js';
import { insertAndNotify } from '../services/publisher.js';
import { summarize } from '../services/summarizer.js';

function stripHtml(html = '') {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

async function findSourceForFromAddress(fromAddress) {
  const { rows: [s] } = await query(
    `SELECT * FROM sources
       WHERE type = 'newsletter' AND active = true
         AND LOWER(identifier) = LOWER($1)
       LIMIT 1`, [fromAddress]
  );
  if (s) return s;
  // Fallback: domain match (e.g. anything @substack.com goes to a
  // catch-all 'substack.com' source if one exists).
  const domain = fromAddress.split('@')[1];
  if (!domain) return null;
  const { rows: [byDomain] } = await query(
    `SELECT * FROM sources
       WHERE type = 'newsletter' AND active = true
         AND LOWER(identifier) = LOWER($1)
       LIMIT 1`, [domain]
  );
  return byDomain || null;
}

async function ingestMessage(parsed) {
  const fromAddress = parsed.from?.value?.[0]?.address;
  if (!fromAddress) return;
  const source = await findSourceForFromAddress(fromAddress);
  if (!source) {
    console.log(`[email] no source mapped for ${fromAddress}, ignoring`);
    return;
  }
  const text = parsed.text || stripHtml(parsed.html || '');
  if (!text) return;
  const { tldr, read_time_min } = await summarize({
    title: parsed.subject, text, kind: 'newsletter',
  });
  await insertAndNotify({
    source_id: source.id,
    external_id: parsed.messageId || `${fromAddress}:${parsed.date?.toISOString() || Date.now()}`,
    title: parsed.subject || null,
    author: parsed.from?.value?.[0]?.name || fromAddress,
    url: null,
    content_text: text,
    content_html: parsed.html || null,
    tldr,
    read_time_min,
    published_at: parsed.date || new Date(),
  });
}

export async function runEmailListener() {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
    console.warn('[email] IMAP not configured; skipping');
    return;
  }
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_TLS !== 'false',
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
    logger: false,
  });

  await client.connect();
  await client.mailboxOpen('INBOX');
  console.log('[email] connected, watching INBOX');

  // Back-fill: process the last 20 unseen messages on startup.
  for await (const msg of client.fetch({ seen: false }, { source: true })) {
    try {
      const parsed = await simpleParser(msg.source);
      await ingestMessage(parsed);
    } catch (e) {
      console.warn('[email] parse failed', e.message);
    }
  }

  // Watch for new arrivals using IDLE.
  client.on('exists', async () => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true })) {
        const parsed = await simpleParser(msg.source);
        await ingestMessage(parsed);
      }
    } catch (e) {
      console.warn('[email] new-message handler failed', e.message);
    } finally {
      lock.release();
    }
  });

  // Keep the connection alive with IDLE.
  // ImapFlow's idle() resolves when we tell it to stop; loop forever.
  while (true) {
    try { await client.idle(); } catch { await new Promise(r => setTimeout(r, 5000)); }
  }
}
