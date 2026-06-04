// Sends a web-push notification for a freshly-ingested post to every
// subscribed device. Called from upsertPost.

import { all, run } from '../lib/db.js';
import { sendWebPush } from '../lib/webPush.js';
import { typeShort } from '../lib/labelsBackend.js';

function vapidFromEnv(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey:  env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject:    env.VAPID_SUBJECT || 'mailto:ansh.tsundoku@gmail.com',
  };
}

export async function notifyNewPost(env, post, domainSlug, sourceType, sourceName, notifyEnabled = 1, domainName = null) {
  const vapid = vapidFromEnv(env);
  if (!vapid) return; // silently skip if not configured

  // Per-source mute — ingestion still runs; only the push is suppressed.
  if (!notifyEnabled) return;

  // Skip notifications for posts older than 24h (initial backfill of a new
  // source shouldn't blow up your lock screen).
  const publishedAt = post.published_at ? new Date(post.published_at).getTime() : null;
  if (publishedAt && publishedAt < Date.now() - 24 * 60 * 60 * 1000) return;

  // Every registered device for this user. Multiple rows per user_id is
  // intended (one per browser/device).
  const subs = await all(env,
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`,
    [post.user_id]);
  if (!subs.length) return;

  const sourceTypeShort = typeShort(sourceType);
  const bodyLine = post.title
    ? `${sourceTypeShort} · ${post.title}`
    : `${sourceTypeShort} · ${sourceName || ''} — ${(post.content_text || '').slice(0, 60)}`;
  const payload = JSON.stringify({
    title: `Tsundoku · ${domainName || domainSlug || 'feed'}`,
    body:  bodyLine.slice(0, 160),
    url:   `/d/${domainSlug}/p/${post.id}`,
    tag:   `tsundoku-post-${post.id}`,
    image: post.image_url || undefined,
  });

  // One device failing must never abort delivery to the others. Drop
  // subscriptions the push service has retired (404/410); log everything else
  // and keep going.
  for (const s of subs) {
    try {
      const r = await sendWebPush({
        subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        vapid,
      });
      if (r.status === 404 || r.status === 410 || r.expired) {
        console.log(`[push] dropping stale subscription ${s.id} (${r.status})`);
        await run(env, `DELETE FROM push_subscriptions WHERE id = ?`, [s.id]);
      } else if (!r.ok) {
        console.warn(`[push] sub ${s.id} → ${r.status}`);
      }
    } catch (e) {
      console.warn(`[push] sub ${s.id} send failed: ${e.message}`);
    }
  }
}
