// Tiny request router for Cloudflare Workers. No deps.
// Usage:
//   const r = new Router();
//   r.get('/api/posts', handler);
//   r.patch('/api/posts/:id', handler);
//   return r.handle(request, env, ctx);
//
// Handlers receive (request, { params, env, ctx, url }) and return a Response.

export class Router {
  constructor() { this.routes = []; }
  add(method, path, handler) {
    // Convert "/api/posts/:id" → /^\/api\/posts\/([^/]+)$/
    const keys = [];
    const pattern = path.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
    this.routes.push({ method, regex: new RegExp(`^${pattern}$`), keys, handler });
    return this;
  }
  get(p, h)    { return this.add('GET', p, h); }
  post(p, h)   { return this.add('POST', p, h); }
  patch(p, h)  { return this.add('PATCH', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  async handle(request, env, ctx) {
    const url = new URL(request.url);
    for (const r of this.routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.regex);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      try {
        const res = await r.handler(request, { params, env, ctx, url });
        return withCors(res, request, env);
      } catch (err) {
        console.error('[router]', err);
        return withCors(json({ error: err.message || 'internal error' }, 500), request, env);
      }
    }
    return withCors(json({ error: 'not found' }, 404), request, env);
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// The frontend (Pages) and API (Worker) live on different registrable domains,
// so requests are cross-site and must use credentialed CORS: the browser
// refuses `*` once credentials are involved, so we reflect a specific,
// allow-listed Origin and send Access-Control-Allow-Credentials.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://tsundoku-e0v.pages.dev',  // production frontend
  'http://localhost:5173',           // vite dev
  'http://localhost:4173',           // vite preview
];
// Cloudflare Pages preview deploys: <hash>.tsundoku-e0v.pages.dev
const PAGES_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.tsundoku-e0v\.pages\.dev$/;

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const extra = String(env?.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  return PAGES_PREVIEW_RE.test(origin);
}

export function withCors(res, request, env) {
  const r = new Response(res.body, res);
  const origin = request?.headers?.get('Origin');
  if (origin && isAllowedOrigin(origin, env)) {
    r.headers.set('access-control-allow-origin', origin);
    r.headers.set('access-control-allow-credentials', 'true');
    r.headers.append('Vary', 'Origin');
  }
  r.headers.set('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  r.headers.set('access-control-allow-headers', 'content-type,authorization');
  return r;
}

export function handleOptions(request, env) {
  return withCors(new Response(null, { status: 204 }), request, env);
}
