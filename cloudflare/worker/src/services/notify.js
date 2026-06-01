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

export async function notifyNewPost(env, post, domainSlug, sourceType, sourceName, notifyEnabled = 1) {
  const vapid = vapidFromEnv(env);
  if (!vapid) return; // silently skip if not configured

  // Per-source mute — ingestion still runs; only the push is suppressed.
  if (!notifyEnabled) return;

  // Skip notifications for posts older than 24h (initial backfill of a new
  // source shouldn't blow up your lock screen).
  const publishedAt = post.published_at ? new Date(post.published_at).getTime() : null;
  if (publishedAt && publishedAt < Date.now() - 24 * 60 * 60 * 1000) return;

  const subs = await all(env,
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`,
    [post.user_id]);
  if (!subs.length) return;

  const title = `Tsundoku · ${domainSlug || 'feed'}`;
  const sourceTag = typeShort(sourceType);
  const bodyLine = post.title
    ? `${sourceTag} · ${post.title}`
    : `${sourceTag} · ${sourceName || ''} — ${(post.content_text || '').slice(0, 60)}`;
  const payload = JSON.stringify({
    title,
    body: bodyLine.slice(0, 160),
    url:  `/d/${domainSlug}/p/${post.id}`,
    tag:  `tsundoku-post-${post.id}`,
  });

  // Send in parallel; clean up gone subscriptions.
  await Promise.allSettled(subs.map(async (s) => {
    const r = await sendWebPush({
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      vapid,
    });
    if (r.expired) {
      console.log(`[push] dropping expired subscription ${s.id}`);
      await run(env, `DELETE FROM push_subscriptions WHERE id = ?`, [s.id]);
    } else if (!r.ok) {
      console.warn(`[push] sub ${s.id} → ${r.status}`);
    }
  }));
}
