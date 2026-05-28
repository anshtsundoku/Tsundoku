// Cloudflare Pages version. The path is always `/api/...`. Pages handles
// the proxy to the Worker via _redirects (see ../../_redirects). In `npm run dev`
// Vite proxies /api to a locally-running `wrangler dev`.

const BASE = '/api';

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
  patchPost: (id, data) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  dismissPost: (id) => request(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ is_dismissed: true }) }),
  listHighlights: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/highlights?${q}`);
  },
  createHighlight: (data) => request('/highlights', { method: 'POST', body: JSON.stringify(data) }),
  deleteHighlight: (id) => request(`/highlights/${id}`, { method: 'DELETE' }),
};
