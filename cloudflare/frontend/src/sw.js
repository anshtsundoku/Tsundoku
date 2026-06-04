// Tsundoku service worker.
//
// vite-plugin-pwa's injectManifest strategy uses this as the SW source —
// __WB_MANIFEST is replaced with the precache list at build time. We add
// push + notificationclick handlers on top.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST || []);

// HTML/navigation requests go network-first so a deploy is picked up promptly
// (the shell can't get stuck on a stale cached index.html). Falls back to cache
// if the network is slow or offline.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'tsundoku-html', networkTimeoutSeconds: 3 }),
);

// Take over as soon as a new SW is installed so push handlers update without
// waiting for every tab to close. (injectManifest doesn't add these for us.)
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push handler ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = {}; }

  const title = data.title || 'Tsundoku';
  const options = {
    body:               data.body  || '',
    icon:               '/icon-dark-192.png',
    badge:              '/icon-dark-192.png',
    image:              data.image,
    data:               { url: data.url || '/' },
    tag:                data.tag || 'tsundoku',
    renotify:           false,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click → focus or open the post ─────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(url, self.location.origin).href;
    const existing = all.find((c) => c.url === target);
    if (existing) { await existing.focus(); return; }
    const sameOrigin = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (sameOrigin) { await sameOrigin.focus(); sameOrigin.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});
