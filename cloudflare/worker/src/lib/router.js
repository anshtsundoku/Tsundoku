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
        return withCors(res);
      } catch (err) {
        console.error('[router]', err);
        return withCors(json({ error: err.message || 'internal error' }, 500));
      }
    }
    return withCors(json({ error: 'not found' }, 404));
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function withCors(res) {
  const r = new Response(res.body, res);
  r.headers.set('access-control-allow-origin', '*');
  r.headers.set('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  r.headers.set('access-control-allow-headers', 'content-type');
  return r;
}

export function handleOptions() {
  return withCors(new Response(null, { status: 204 }));
}
