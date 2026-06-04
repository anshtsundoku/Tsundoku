// Web push subscription lifecycle on the client side.
//
// Usage:
//   const status = await getPushStatus();   // { configured, supported, subscribed, permission }
//   await subscribeToPush();                 // prompts permission + registers
//   await unsubscribeFromPush();

import { getToken } from './api.js';

const API_BASE = 'https://tsundoku-api.ansh-tsundoku.workers.dev/api';

// Every push endpoint is behind the auth gate, so calls must carry the same
// credentials as the rest of the API client: the Bearer token (the reliable
// cross-site path) plus the credentialed cookie.
function authedFetch(path, opts = {}) {
  const token = getToken();
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  return await navigator.serviceWorker.ready;
}

async function fetchVapidKey() {
  const r = await authedFetch('/push/vapid-public-key');
  if (!r.ok) return null;
  const data = await r.json();
  return data.key;
}

export async function getPushStatus() {
  // Push needs all three primitives. Desktop and Android regular tabs have
  // them, so they count as supported (only true outliers fall through).
  const supported =
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  // iOS only delivers web push from a home-screen-installed PWA. Detect the
  // "needs install first" case so the UI can show install copy instead of a
  // turn-on button that would silently fail.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
  const iosNeedsInstall = isIOS && !isPWA;

  const permission = supported ? Notification.permission : 'unsupported';

  let configured = false;
  try { configured = Boolean(await fetchVapidKey()); } catch { /* ignore */ }

  let subscribed = false;
  if (supported) {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    subscribed = Boolean(sub);
  }

  return { supported, iosNeedsInstall, configured, subscribed, permission };
}

export async function subscribeToPush() {
  const reg = await getRegistration();
  if (!reg) throw new Error('Push not supported in this browser.');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission denied.');

  const key = await fetchVapidKey();
  if (!key) throw new Error('Push not configured on the server.');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(key),
  });

  const body = JSON.stringify({
    endpoint: sub.endpoint,
    keys: {
      p256dh: arrayBufferToB64(sub.getKey('p256dh')),
      auth:   arrayBufferToB64(sub.getKey('auth')),
    },
    userAgent: navigator.userAgent,
  });
  const res = await authedFetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);
  return true;
}

export async function unsubscribeFromPush() {
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  await authedFetch('/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
  return true;
}

function arrayBufferToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
