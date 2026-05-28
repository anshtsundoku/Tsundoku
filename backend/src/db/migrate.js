import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[migrate] schema applied');

  // Bootstrap the single user + default domains if missing.
  const email = process.env.OWNER_EMAIL || 'ansh.dwivedi@flipkart.com';
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email]
  );

  const defaults = [
    { name: 'Football',    slug: 'football',    icon: 'football',    sort_order: 1 },
    { name: 'AI',          slug: 'ai',          icon: 'sparkle',     sort_order: 2 },
    { name: 'Consumerism', slug: 'consumerism', icon: 'shopping',    sort_order: 3 },
    { name: 'Product',     slug: 'product',     icon: 'cube',        sort_order: 4 },
  ];

  for (const d of defaults) {
    await pool.query(
      `INSERT INTO domains (user_id, name, slug, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, slug) DO NOTHING`,
      [user.id, d.name, d.slug, d.icon, d.sort_order]
    );
  }

  console.log('[migrate] defaults seeded for user', email);
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
