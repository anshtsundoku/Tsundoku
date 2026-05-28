# Tsundoku — Cloudflare deployment

A $0/month feed reader, self-hosted on Cloudflare's free tier. Repository: <https://github.com/anshtsundoku/Tsundoku>.

The architecture:

- **Frontend** → Cloudflare Pages (PWA, served from CDN)
- **API + ingestion** → Cloudflare Worker with cron triggers (`tsundoku-api`)
- **Database** → Cloudflare D1 (`tsundoku`, SQLite)
- **Newsletters** → Gmail API (no IMAP needed; runs in Worker)
- **AI summaries** → Google Gemini API (free tier)
- **Twitter** → direct x.com web API with your session cookies
- **Auth** → Cloudflare Access (Google email login, free)

New content arrives via 30-second polling — close enough to real-time for a feed reader.

See **DEPLOY-CF.md** for the full step-by-step.

## Layout

```
cloudflare/
├─ worker/                  Cloudflare Worker code
│  ├─ src/
│  │  ├─ index.js           fetch + scheduled entries
│  │  ├─ routes/            domains, sources, posts, highlights, admin
│  │  ├─ ingest/            rss, twitter, youtube, newsletter
│  │  ├─ services/          summarizer (Gemini), feed discovery, RSS parse
│  │  └─ lib/               router, D1 helper
│  ├─ migrations/
│  │  ├─ 0001_init.sql      schema + bootstrap domains
│  │  └─ 0002_seed.sql      optional sample content
│  ├─ wrangler.toml         d1 binding + cron triggers
│  └─ package.json
└─ frontend/                Cloudflare Pages site
   ├─ src/                  React PWA — same UI as the Docker version, polls instead of WebSocket
   ├─ public/               favicon.svg + 192/512 book icons
   ├─ _redirects            SPA fallback + /api proxy to Worker
   └─ package.json
```

## Quick local dev

```bash
# Worker — runs at http://localhost:8787
cd cloudflare/worker
npm install
wrangler d1 create tsundoku        # one-time
# paste database_id into wrangler.toml
npm run migrate:local
npm run seed:local
npm run dev

# Frontend — runs at http://localhost:5173, proxies /api to localhost:8787
cd cloudflare/frontend
npm install
npm run dev
```

## Production

Push to `main` → Pages auto-builds the frontend. `npm run deploy` in `cloudflare/worker/` ships the Worker. Full walkthrough in DEPLOY-CF.md.
