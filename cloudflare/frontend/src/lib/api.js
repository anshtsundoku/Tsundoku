// API client.
//
// Calls go directly to the Cloudflare Worker (cross-origin). The worker is
// CORS-enabled (access-control-allow-origin: *), so this works without any
// Pages _redirects rule on /api/* — the frontend just talks to the worker
// directly. If you ever rename the worker, update this one line.

const BASE = 'https://tsundoku-api.ansh-tsundoku.workers.dev/api';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listDomains: () => request('/domains'),
  createDomain: (data) => request('/domains', { method: 'POST', body: JSON.stringify(data) }),

  listSources: (domainSlug) => request(`/sources${domainSlug ? `?domain=${domainSlug}` : ''}`),
  createSource: (data) => request('/sources', { method: 'POST', body: JSON.stringify(data) }),
  deleteSource: (id) => request(`/sources/${id}`, { method: 'DELETE' }),

  listPosts: (domainSlug, filter = 'unread', cursor) => {
    const q = new URLSearchParams({ domain: domainSlug, filter });
    if (cursor) q.set('cursor', cursor);
    return request(`/posts?${q}`);
  },
  getPost: (id) => request(`/posts/${id}`),
  patchPost: (id, data) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  dismissPost: (id) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ is_dismissed: true }) }),

  listHighlights: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/highlights?${q}`);
  },
  createHighlight: (data) => request('/highlights', { method: 'POST', body: JSON.stringify(data) }),
  deleteHighlight: (id) => request(`/highlights/${id}`, { method: 'DELETE' }),

  // Cross-device preferences (theme).
  getPrefs:   () => request('/prefs'),
  patchPrefs: (data) => request('/prefs', { method: 'PATCH', body: JSON.stringify(data) }),
};
