// API client.
//
// Calls go directly to the Cloudflare Worker (cross-origin / cross-site). Auth
// is carried two ways: a credentialed cookie (works same-site / on browsers
// that still allow third-party cookies) AND a Bearer token stored in
// localStorage (the reliable cross-site path, including iOS Safari). The login
// response returns the token; we attach it to every request.

const BASE = 'https://tsundoku-api.ansh-tsundoku.workers.dev/api';
const TOKEN_KEY = 'tsundoku.session';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode / storage disabled */ }
}
export function clearToken() { setToken(null); }

async function request(path, opts = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    // No HTTP response at all (offline, DNS, connection refused). Surface a
    // single calm toast; callers still get the thrown error to handle locally.
    if (typeof window !== 'undefined') {
      window.toast?.('couldn\'t reach tsundoku. try again?', { kind: 'error' });
    }
    throw e;
  }
  if (res.status === 401) {
    // A 401 while we held a token means the session expired mid-use: drop the
    // stale token and reload so App re-mounts on the Landing page. When there's
    // no token (e.g. the initial /auth/me probe on Landing) we just throw, so
    // there's no reload loop.
    if (getToken()) { clearToken(); window.location.reload(); }
    throw new Error('401 unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth + account lifecycle.
  googleAuth: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  me:         () => request('/auth/me'),
  logout:     () => request('/auth/logout', { method: 'POST' }),
  completeOnboarding: () => request('/auth/onboarding-complete', { method: 'POST' }),
  setOnboardingStep: (step) => request('/auth/onboarding-step', { method: 'PATCH', body: JSON.stringify({ step }) }),
  deleteAccount: () => request('/account', { method: 'DELETE' }),
  // Full JSON export of the user's data (credentials excluded server-side).
  exportData: () => request('/account/export'),

  listDomains: () => request('/domains'),
  createDomain: (data) => request('/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id, data) => request(`/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDomain: (id) => request(`/domains/${id}`, { method: 'DELETE' }),

  listSources: (domainSlug) => request(`/sources${domainSlug ? `?domain=${domainSlug}` : ''}`),
  createSource: (data) => request('/sources', { method: 'POST', body: JSON.stringify(data) }),
  patchSource:  (id, data) => request(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  patchSourceNotify: (id, enabled) =>
    request(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify({ notify_enabled: enabled }) }),
  bulkNotifications: (enabled) =>
    request('/sources/notifications/bulk', { method: 'POST', body: JSON.stringify({ enabled }) }),
  deleteSource: (id) => request(`/sources/${id}`, { method: 'DELETE' }),
  // Trigger a manual first fetch for one source (used right after adding it).
  ingestNow: (id) => request(`/sources/${id}/ingest-now`, { method: 'POST' }),

  listPosts: ({ domain, type, filter = 'unread', cursor } = {}) => {
    const q = new URLSearchParams({ filter });
    if (domain) q.set('domain', domain);
    if (type)   q.set('type', type);
    if (cursor) q.set('cursor', cursor);
    return request(`/posts?${q}`);
  },
  getPost: (id) => request(`/posts/${id}`),
  patchPost: (id, data) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  markReadBulk: (domainId) => request('/posts/mark-read-bulk', { method: 'POST', body: JSON.stringify({ domain_id: domainId }) }),
  // Clear (dismiss) every visible post in a domain at once.
  clearDomain: (domainId) => request('/posts/clear-domain', { method: 'POST', body: JSON.stringify({ domain_id: domainId }) }),
  // Cheap freshness probe for the realtime poll. Pass { domain } or { type } to scope.
  heartbeat: ({ domain, type } = {}) => {
    const q = new URLSearchParams();
    if (domain) q.set('domain', domain);
    if (type)   q.set('type', type);
    const qs = q.toString();
    return request(`/posts/heartbeat${qs ? `?${qs}` : ''}`);
  },
  searchPosts: (q) => request(`/posts/search?q=${encodeURIComponent(q)}`),
  libraryPosts: () => request('/posts/library'),
  dismissPost: (id) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ is_dismissed: true }) }),
  // Unread count per source type — for the New Reads/Watches row on Home.
  sourceCounts: () => request('/posts/source-counts'),

  listHighlights: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/highlights?${q}`);
  },
  createHighlight: (data) => request('/highlights', { method: 'POST', body: JSON.stringify(data) }),
  deleteHighlight: (id) => request(`/highlights/${id}`, { method: 'DELETE' }),

  // Cross-device preferences (theme).
  getPrefs:   () => request('/prefs'),
  patchPrefs: (data) => request('/prefs', { method: 'PATCH', body: JSON.stringify(data) }),

  // Credential vault. getCredentials returns booleans only (never values).
  getCredentials:   () => request('/credentials'),
  patchCredential:  (kind, value) => request('/credentials', { method: 'PATCH', body: JSON.stringify({ kind, value }) }),
  deleteCredential: (kind) => request(`/credentials/${kind}`, { method: 'DELETE' }),

  // Gmail OAuth. gmailStart returns { url } to redirect the browser to Google.
  gmailStart:      () => request('/auth/gmail/start'),
  gmailDisconnect: () => request('/auth/gmail/disconnect', { method: 'POST' }),

  // Browser-extension pairings. pairExtension returns the plaintext token ONCE.
  pairExtension: ({ name } = {}) => request('/extension/pair', { method: 'POST', body: JSON.stringify({ name }) }),
  listPairings:  () => request('/extension/pairings'),
  revokePairing: (id) => request(`/extension/pairings/${id}`, { method: 'DELETE' }),
};
