// Tsundoku — X sync (MV3 service worker).
//
// Watches x.com auth cookies and pushes them to Tsundoku so the X ingestion
// cron can fetch posts on your behalf. Authenticates with a long-lived pairing
// bearer token obtained through the web-app pairing flow.

const API_BASE = 'https://tsundoku-api.ansh-tsundoku.workers.dev/api';
const COOKIE_NAMES = ['auth_token', 'ct0'];
const DEBOUNCE_MS = 5000;

let debounceTimer = null;

// ---- storage helpers -------------------------------------------------------
async function getStored() {
  return await chrome.storage.local.get(['token', 'userEmail', 'lastSyncedAt', 'pairingInvalid']);
}
async function setStored(patch) {
  await chrome.storage.local.set(patch);
}

// ---- cookie reads ----------------------------------------------------------
async function readXCookies() {
  const [authCookie, ct0Cookie] = await Promise.all([
    chrome.cookies.get({ url: 'https://x.com', name: 'auth_token' }),
    chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }),
  ]);
  return {
    auth_token: authCookie?.value || null,
    ct0: ct0Cookie?.value || null,
  };
}

// ---- the one write path ----------------------------------------------------
// Returns { ok: true } | { ok: false, error, status? }.
async function syncCookies() {
  const { token, pairingInvalid } = await getStored();
  if (!token) return { ok: false, error: 'not paired' };
  if (pairingInvalid) return { ok: false, error: 'pairing expired' };

  const { auth_token, ct0 } = await readXCookies();
  if (!auth_token || !ct0) return { ok: false, error: 'sign in to x.com first' };

  let res;
  try {
    res = await fetch(`${API_BASE}/extension/twitter-cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ auth_token, ct0 }),
    });
  } catch (e) {
    return { ok: false, error: e.message || 'network error' };
  }

  if (res.status === 401) {
    // Token revoked or invalid — stop syncing until the user re-pairs.
    await setStored({ pairingInvalid: true });
    return { ok: false, error: 'pairing expired', status: 401 };
  }
  if (res.status === 429) {
    // Rate limited — not an error worth surfacing; the value is unchanged.
    return { ok: true };
  }
  if (!res.ok) return { ok: false, error: `sync failed (${res.status})`, status: res.status };

  await setStored({ lastSyncedAt: Date.now() });
  return { ok: true };
}

function scheduleSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debounceTimer = null; syncCookies(); }, DEBOUNCE_MS);
}

// ---- cookie change watcher -------------------------------------------------
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (!cookie) return;
  if (!/\.?x\.com$/.test(cookie.domain || '')) return;
  if (!COOKIE_NAMES.includes(cookie.name)) return;
  scheduleSync();
});

// ---- periodic safety net ---------------------------------------------------
chrome.alarms.create('periodic-sync', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodic-sync') syncCookies();
});

// ---- popup / content-script messaging --------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'STORE_TOKEN': {
        await setStored({
          token: msg.token,
          userEmail: msg.userEmail || null,
          pairingInvalid: false,
          lastSyncedAt: null,
        });
        // Try an immediate sync so the user sees a result without visiting x.com.
        syncCookies();
        sendResponse({ ok: true });
        break;
      }
      case 'GET_STATUS': {
        const s = await getStored();
        sendResponse({
          paired: Boolean(s.token),
          userEmail: s.userEmail || null,
          lastSyncedAt: s.lastSyncedAt || null,
          pairingInvalid: Boolean(s.pairingInvalid),
        });
        break;
      }
      case 'SYNC_NOW': {
        const r = await syncCookies();
        sendResponse(r);
        break;
      }
      case 'DISCONNECT': {
        await chrome.storage.local.clear();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true; // keep the message channel open for the async response
});
