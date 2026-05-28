// Seeds a handful of demo posts so the UI is usable end-to-end without
// external APIs configured. Safe to re-run — uses ON CONFLICT.
import { pool } from './index.js';

const SAMPLE = [
  // Football
  { domain: 'football', source_type: 'rss', source_id: 'theathletic.com/football',
    title: 'Why pressing defenses are dominating the Champions League',
    author: 'The Athletic', url: 'https://example.com/athletic-press',
    text: 'A tactical breakdown of how high-pressure systems have reshaped European football this season. Top clubs are recovering possession in the final third more than ever, and the data tells an interesting story about why opposition managers are struggling to adapt.',
    image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800',
    tldr: 'Pressing schemes are winning more high turnovers this UCL season. Coaches are struggling to counter without dropping deeper.',
    read: 4 },
  { domain: 'football', source_type: 'twitter', source_id: 'fabrizio_romano',
    title: null, author: '@FabrizioRomano', url: 'https://example.com/tweet-1',
    text: 'Here we go! Florian Wirtz to Real Madrid, deal completed. Five-year contract, medical scheduled for Monday in Madrid. Bayer Leverkusen receive €130m fixed plus add-ons. 🇩🇪⚪',
    image: null,
    tldr: 'Wirtz to Real Madrid confirmed — €130m + add-ons, 5-year deal.',
    read: 1 },

  // AI
  { domain: 'ai', source_type: 'newsletter', source_id: 'Stratechery',
    title: 'The shape of post-training', author: 'Ben Thompson', url: 'https://example.com/strat-1',
    text: 'The frontier labs have quietly shifted where the value is created. Pre-training compute is no longer the bottleneck; post-training — RLHF, RLAIF, and an increasingly long tail of evaluation harnesses — is doing the heavy lifting. This has implications for the moat, for hiring, and for how investors should think about CapEx.',
    image: null,
    tldr: 'Value in frontier models is shifting from pre-training to post-training. Reshapes moats and CapEx logic.',
    read: 7 },
  { domain: 'ai', source_type: 'youtube', source_id: 'YannicKilcher',
    title: 'New paper: Memory-augmented transformers can dramatically reduce inference cost',
    author: 'Yannic Kilcher', url: 'https://example.com/yk-1',
    text: 'Detailed summary: The paper proposes a retrieval-cached attention mechanism where KV-cache fragments persist across queries, indexed by semantic similarity. On long-context benchmarks this yields 3-5x inference speedups with under 1% quality regression. Notable: the gains are largest on conversational workloads where context overlap is high. Limitations: cache invalidation is non-trivial and memory footprint grows linearly.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
    video: 'https://example.com/video-1',
    tldr: 'Retrieval-cached KV attention gives 3-5x inference speedup with <1% quality loss on long contexts.',
    read: 12 },

  // Consumerism
  { domain: 'consumerism', source_type: 'rss', source_id: 'NotBoring',
    title: 'The new American shopping cart',
    author: 'Packy McCormick', url: 'https://example.com/notboring-1',
    text: 'A look at how vertically integrated DTC brands are using AI-driven personalization to rebuild the shopping experience from scratch. The interesting wrinkle: many are now profitable not because of marketing efficiency but because of better unit economics on returns.',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
    tldr: 'DTC profitability is being driven less by ads, more by smarter returns management.',
    read: 6 },

  // Product
  { domain: 'product', source_type: 'newsletter', source_id: 'Lenny\'s Newsletter',
    title: 'How Linear approaches product reviews',
    author: 'Lenny Rachitsky', url: 'https://example.com/lenny-1',
    text: 'Linear runs weekly product reviews differently from most companies — async-first, with a tight written template that forces the team to make explicit tradeoffs. The format is reproducible: status, deltas, the one decision needed, and a 10-min sync only if a blocker emerges.',
    image: null,
    tldr: 'Linear\'s async-first product reviews force explicit tradeoffs in a tight written template.',
    read: 5 },
  { domain: 'product', source_type: 'twitter', source_id: 'shreyas',
    title: null, author: '@shreyas', url: 'https://example.com/tweet-2',
    text: 'Most product strategy docs fail at the same place: they\'re a list of features dressed up as a thesis. A strategy answers: what is uniquely true about us, what changes in the world made now the time, and what will we deliberately not do?',
    image: null,
    tldr: 'A strategy isn\'t a feature list — it answers what\'s uniquely true, what changed, and what you won\'t do.',
    read: 1 },
];

async function main() {
  const { rows: [user] } = await pool.query(`SELECT id FROM users LIMIT 1`);
  if (!user) {
    console.error('[seed] no user found — run migrate first');
    process.exit(1);
  }

  const { rows: domains } = await pool.query(
    `SELECT id, slug FROM domains WHERE user_id = $1`, [user.id]
  );
  const domainMap = Object.fromEntries(domains.map(d => [d.slug, d.id]));

  for (const item of SAMPLE) {
    const domainId = domainMap[item.domain];
    if (!domainId) continue;

    const { rows: [src] } = await pool.query(
      `INSERT INTO sources (user_id, domain_id, type, identifier, display_name)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (user_id, type, identifier)
       DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [user.id, domainId, item.source_type, item.source_id]
    );

    await pool.query(
      `INSERT INTO posts
        (source_id, domain_id, user_id, external_id, title, author, url,
         content_text, image_url, video_url, tldr, read_time_min, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() - (random() * interval '24 hours'))
       ON CONFLICT (source_id, external_id) DO NOTHING`,
      [src.id, domainId, user.id, item.url, item.title, item.author, item.url,
       item.text, item.image || null, item.video || null, item.tldr, item.read]
    );
  }

  console.log('[seed] sample content inserted');
  await pool.end();
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
