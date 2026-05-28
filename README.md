# Mindful

A self-hosted, free-forever feed reader that pulls together newsletters, RSS, YouTube channels, and Twitter accounts into four domains you care about (Football, AI, Consumerism, Product — fully editable). Real-time updates over WebSocket. AI-generated TLDR and read-time estimate on every item. Read / Unread / Bookmark tabs per domain. Text highlighting that you can save and revisit. Installs as a PWA on your iPhone and works from any browser.

Built for one user (you), runs entirely on your own infrastructure.

---

## What it does

- **Sources** of four types: RSS feeds, websites with RSS, Twitter handles (via Nitter), YouTube channels (with AI video summaries), and newsletters (via IMAP).
- **Domains** group your sources. Defaults: Football, AI, Consumerism, Product. Add/rename as you like.
- **Feed view** per domain with three tabs: Unread, Read, Bookmarked.
- **Real-time push**: when a new newsletter lands, or a new tweet arrives, it shows up in the open app without refresh.
- **Highlights**: select any text inside a post and save it. Highlights persist across reloads and are exported per domain.
- **Theme**: dark + light mode, wood-brown + warm-grey palette. Calibri (or Carlito fallback) throughout.
- **PWA**: install on iPhone home screen and it looks/behaves like a native app.

---

## Architecture (one paragraph)

A Postgres database holds your sources, domains, posts, and highlights. A small Node.js API serves the web UI. A separate worker process polls each source on its own cadence (RSS every 5 min, Twitter every 3 min, YouTube every 15 min) and an IMAP listener watches a dedicated newsletter inbox in real time. Whenever something new arrives, the worker writes it to Postgres and publishes on a Redis channel; the API picks that up and pushes to your open browser over a WebSocket. The React PWA frontend renders the feed and handles read/bookmark/highlight state. Everything runs in Docker on a single small free-tier VM.

---

## Free hosting: Oracle Cloud Always Free

Oracle Cloud's Always Free tier gives you 4 ARM cores + 24 GB RAM forever, no credit card hold expiry. That's enormous overkill for this app — perfect.

1. Sign up at <https://www.oracle.com/cloud/free/>. Pick the home region with capacity (often Frankfurt or London for ARM).
2. Create a "VM.Standard.A1.Flex" Compute instance. Allocate 2 OCPU + 12 GB RAM (well within free tier).
3. Choose **Canonical Ubuntu 22.04** as the image.
4. Add your SSH public key.
5. After it boots: open ports 80 and 443 in the VCN's security list (ingress from 0.0.0.0/0 on tcp/80 and tcp/443).

SSH into it and install Docker:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

Alternative: Google Cloud's `e2-micro` is also always-free (1 vCPU, 1 GB RAM, 30 GB disk) in `us-west1`, `us-central1`, or `us-east1`. Tighter on memory but workable.

---

## First-time deploy

```bash
git clone <your-repo>  # or scp this folder up
cd mindful
cp backend/.env.example backend/.env
# Open backend/.env and fill in GEMINI_API_KEY, YOUTUBE_API_KEY, IMAP_*
docker compose build
docker compose up -d
docker compose exec backend node src/db/migrate.js
docker compose exec backend node src/db/seed.js   # optional: demo content
```

Open `http://<your-server-ip>/` — the app is live. Add your sources from the Sources page.

---

## Getting the API keys (all free)

**Gemini (for TLDR + YouTube summaries)** — free tier: 15 RPM, 1500 RPD, 1M tokens/day.
1. Go to <https://aistudio.google.com/app/apikey>.
2. Click "Create API key" → copy.
3. Paste into `backend/.env` as `GEMINI_API_KEY`.

**YouTube Data API v3** — free, 10 000 quota units/day (more than enough for ~50 channel checks/day).
1. Go to <https://console.cloud.google.com/>, create a project (or reuse Gemini's).
2. APIs & Services → Library → enable "YouTube Data API v3".
3. Credentials → Create credentials → API key → copy.
4. Paste into `backend/.env` as `YOUTUBE_API_KEY`.

---

## Newsletter setup (Kill-the-Newsletter style)

Create a free dedicated Gmail account just for newsletters — say `mindful.ansh@gmail.com`. Sign up to your newsletters with this address. Don't use your work or personal inbox; you want a clean stream.

In that Gmail account:
1. Enable 2-Step Verification.
2. Generate an **App Password** (Google account → Security → App passwords → "Mail").
3. Put the App Password into `backend/.env` as `IMAP_PASSWORD`. `IMAP_USER` is the full email address.

When you Add a newsletter source in the app, the "Identifier" is the sender's email address (e.g. `newsletter@stratechery.com`). The worker matches incoming emails against this. You can also use just the domain (e.g. `substack.com`) as a catch-all.

---

## Twitter source: an honest note

Twitter has aggressively blocked third-party scrapers. As of this writing:

- **Nitter** (included in `docker-compose.yml` on port 8081): works intermittently — sometimes needs guest-account cookies that have to be refreshed. If `http://<server>:8081/elonmusk` returns content, you're fine; if it shows "Instance has been rate-limited", you need guest tokens (see the Nitter README) or fall back to:
- **RSSHub** (included on port 1200): broader fallback, also rate-limited on Twitter routes lately.

If Twitter is critical and the free routes are flaky for you, the official **X API Basic tier ($100/mo)** is the only fully reliable path. Until then, Twitter ingestion is best-effort and the rest of the app works fine.

---

## Install as a PWA on iPhone

1. Open the app in Safari on your iPhone (use HTTPS if you've set it up; see HTTPS section below).
2. Tap the **Share** button → **Add to Home Screen**.
3. The app now opens fullscreen like a native app. iOS doesn't support web push notifications fully in PWAs yet (improving in 2024+), so you won't get push alerts — but the in-app real-time feed updates instantly when you have the app open.

---

## HTTPS (optional but recommended for PWA install)

Easiest path: free DuckDNS subdomain + Caddy.

1. Sign in at <https://www.duckdns.org> with GitHub/Google, claim e.g. `ansh-mindful.duckdns.org`, point it to your Oracle VM's IP.
2. On the VM:

   ```bash
   sudo apt install -y caddy
   sudo tee /etc/caddy/Caddyfile <<EOF
   ansh-mindful.duckdns.org {
     reverse_proxy localhost:80
   }
   EOF
   sudo systemctl restart caddy
   ```

3. Open port 443 in the Oracle VCN security list. Caddy will auto-issue Let's Encrypt certs.

Now visit `https://ansh-mindful.duckdns.org` and install the PWA.

---

## Local development

```bash
# in two terminals
cd backend && npm install && cp .env.example .env && npm run migrate && npm run seed && npm run dev
cd frontend && npm install && npm run dev
# in a third terminal (optional) for source ingestion
cd backend && npm run workers
```

Or just `docker compose up` from the root.

---

## Project layout

```
mindful/
├─ backend/                  Node.js API + ingestion workers
│  ├─ src/
│  │  ├─ server.js           Express + Socket.io
│  │  ├─ db/                 schema, migrate, seed
│  │  ├─ routes/             /api/{domains,sources,posts,highlights}
│  │  ├─ services/           summarizer (Gemini), Redis publisher
│  │  └─ workers/            rss / twitter / youtube / email ingestion
│  ├─ Dockerfile             API image
│  └─ Dockerfile.workers     Workers image
├─ frontend/                 React + Vite + Tailwind PWA
│  ├─ src/
│  │  ├─ pages/              Home, Domain, Sources
│  │  ├─ components/         PostCard, PostDetail (with highlighter), Icons
│  │  ├─ lib/                api client, socket, theme
│  │  └─ styles/index.css    palette + typography
│  ├─ Dockerfile             nginx + built SPA
│  └─ nginx.conf             SPA + API/WS proxy
├─ infra/
│  └─ nitter.conf            Nitter self-host config
├─ docker-compose.yml        full stack
└─ README.md                 (you are here)
```

---

## Cost summary

| Item                     | Cost      |
|--------------------------|-----------|
| Oracle Cloud VM          | $0 forever |
| Gemini API (free tier)   | $0 (1500 req/day) |
| YouTube Data API         | $0 (10k units/day) |
| Gmail account (newsletters) | $0 |
| DuckDNS subdomain        | $0 |
| Let's Encrypt cert (Caddy) | $0 |
| Docker / Postgres / Redis | $0 (open source) |
| **Total**                | **$0/mo, forever** |

If Twitter reliability becomes critical you may want X API Basic at $100/mo. Optional, not required.

---

## Roadmap ideas (easy to add later)

- Audio mode (TTS) for commutes — Web Speech API, free.
- Highlights notebook view + markdown export.
- "Pick for me" with time budget.
- Source health indicators (last successful poll, error count).
- Cross-domain search.
- Weekly digest email of what you read + your top highlights.
