// Routes for web push subscription management + a one-shot VAPID key
// generator that's gated by the admin token (used during initial setup).

import { first, run } from '../lib/db.js';
import { currentUser } from '../lib/auth.js';
import { json } from '../lib/router.js';
import { generateVapidKeys } from '../lib/webPush.js';

// GET /api/push/vapid-public-key
// Returns the configured VAPID public key so the browser can subscribe.
// 404 if not configured.
export async function vapidPublicKey(_req, { env }) {
  if (!env.VAPID_PUBLIC_KEY) return json({ error: 'push not configured' }, 404);
  return json({ key: env.VAPID_PUBLIC_KEY });
}

// POST /api/push/subscribe
// Body: { endpoint, keys: { p256dh, auth }, userAgent? }
export async function subscribe(request, { env }) {
  const u = await currentUser(env, request);
  const body = await request.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return json({ error: 'malformed subscription' }, 400);
  }
  await run(env, `
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id    = excluded.user_id,
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      user_agent = excluded.user_agent
  `, [u.id, body.endpoint, body.keys.p256dh, body.keys.auth, body.userAgent || null]);
  return json({ ok: true });
}

// DELETE /api/push/subscribe — body { endpoint }
export async function unsubscribe(request, { env }) {
  const body = await request.json().catch(() => ({}));
  if (!body?.endpoint) return json({ error: 'endpoint required' }, 400);
  await run(env, `DELETE FROM push_subscriptions WHERE endpoint = ?`, [body.endpoint]);
  return json({ ok: true });
}

// GET /api/push/status — { configured, subscribed }
export async function pushStatus(request, { env, url }) {
  const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const endpoint = url.searchParams.get('endpoint');
  let subscribed = false;
  if (endpoint) {
    const row = await first(env, `SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
    subscribed = Boolean(row);
  }
  return json({ configured, subscribed });
}

// POST /api/admin/vapid-gen — admin-gated, generates a fresh key pair.
// Output is meant to be copied into `wrangler secret put VAPID_PUBLIC_KEY`
// and `wrangler secret put VAPID_PRIVATE_KEY`.
export async function vapidGen(req, { env }) {
  // Reuses the admin auth check
  if (env.ADMIN_TOKEN && req.headers.get('x-admin-token') !== env.ADMIN_TOKEN) {
    return json({ error: 'unauthorized' }, 401);
  }
  const keys = await generateVapidKeys();
  return json({
    publicKey:  keys.publicKey,
    privateKey: keys.privateKey,
    instructions: [
      'wrangler secret put VAPID_PUBLIC_KEY  (paste the publicKey above)',
      'wrangler secret put VAPID_PRIVATE_KEY (paste the privateKey above)',
      'wrangler secret put VAPID_SUBJECT     (e.g. mailto:you@example.com)',
    ],
  });
}
