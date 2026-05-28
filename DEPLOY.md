# Deploy Mindful on Google Cloud (free, ~15 minutes)

Plain copy-paste path using **Google Cloud's e2-micro Always Free** tier. 1 vCPU, 1 GB RAM, free forever in `us-west1`, `us-central1`, or `us-east1`.

The full stack is slimmed down to fit in 1 GB RAM — Postgres + Redis + the API + workers + frontend. Twitter (self-hosted Nitter + RSSHub) is optional and disabled by default because it doesn't fit; everything else works fully.

---

## Part 1 — Create the VM (one-time, ~5 min)

1. Sign in at <https://console.cloud.google.com>. New users get $300 free credit, separate from the always-free e2-micro.
2. Top-left menu → **Compute Engine** → **VM instances** → **Create instance**.
3. Configure exactly this — anything else may not be free:
   - **Name:** `mindful`
   - **Region:** `us-west1` (Oregon), `us-central1` (Iowa), or `us-east1` (South Carolina) — must be one of these for free tier.
   - **Zone:** any in that region.
   - **Machine configuration:** Series `E2`, machine type `e2-micro` (2 vCPU, 1 GB).
   - **Boot disk:** click Change → OS `Ubuntu`, version `Ubuntu 22.04 LTS`, type `Standard persistent disk`, size `30 GB` (max free).
   - **Firewall:** check both **Allow HTTP traffic** and **Allow HTTPS traffic**.
4. Click **Create**.

Note the **External IP** that appears (you'll need it in a minute).

---

## Part 2 — Get your three API keys (one-time, ~3 min)

| Key                       | Where                                                                                                | Cost |
|---------------------------|------------------------------------------------------------------------------------------------------|------|
| `GEMINI_API_KEY`          | <https://aistudio.google.com/app/apikey> → Create API key                                            | Free |
| `YOUTUBE_API_KEY`         | <https://console.cloud.google.com> → APIs & Services → Library → enable "YouTube Data API v3" → Credentials → Create API key | Free |
| Dedicated newsletter Gmail | Create a fresh Gmail (e.g. `ansh.mindful@gmail.com`) just for newsletters. Enable 2-Step Verification → Security → App passwords → "Mail" → 16-char password | Free |
| Twitter cookies            | See "Twitter cookie setup" below — 5 min, one time                                                  | Free |

Subscribe to your newsletters using that fresh Gmail address.

### Twitter cookie setup (5 min, one time)

We scrape Twitter using your own browser session — no separate Nitter container, no $100/mo X API. You log in once, copy 4 cookie values into `.env`, the worker uses them to fetch tweets.

1. Open <https://x.com> in Chrome/Firefox/Edge and log in (using a Twitter account is fine — ideally a dedicated/secondary one rather than your main, since automated reads have a small chance of triggering a captcha challenge).
2. Press `F12` (or right-click → Inspect) to open DevTools → **Application** tab (Chrome) or **Storage** (Firefox) → **Cookies** → `https://x.com`.
3. Find these four cookies and copy their values:

   | Cookie name | Goes into `.env` as       | Required? |
   |-------------|---------------------------|-----------|
   | `auth_token`| `TWITTER_AUTH_TOKEN`       | Yes |
   | `ct0`       | `TWITTER_CT0`              | Yes |
   | `kdt`       | `TWITTER_KDT`              | Optional |
   | `guest_id`  | `TWITTER_GUEST_ID`         | Optional |

4. Paste them into `backend/.env` and restart the workers (`docker compose restart workers`).
5. Add Twitter handles via the Sources page and you're done. New tweets show up within ~20 minutes (configurable via `TWITTER_POLL_INTERVAL`).

If Twitter ever stops returning tweets, the cookies have rotated — re-extract and update `.env`. Usually lasts weeks at a time.

---

## Part 3 — Deploy

```bash
# From your laptop, SSH into the VM (use the SSH button in the GCP console
# for the first connection; it sets up your key automatically).
# Or:  gcloud compute ssh mindful --zone <your-zone>

# Once you're on the VM:
git clone <your-repo-url> mindful   # or scp up if no repo
cd mindful

# First run: installs Docker, sets up 2 GB swap (important on 1 GB RAM),
# creates .env from example, then exits.
./deploy.sh

# Log out and back in so the docker group takes effect:
exit
# (reconnect)
cd mindful

# Edit .env with your three keys
nano backend/.env

# Run deploy again — this time it builds and starts everything
./deploy.sh
```

That's it. Open `http://<external-ip>/` in your browser.

> **Why the swap?** GCP e2-micro is 1 GB RAM. The stack fits, but Docker builds and Node spikes briefly. A 2 GB swap absorbs those without OOM-killing anything. `deploy.sh` sets this up automatically.

---

## Part 4 — Optional: HTTPS + custom URL (~3 min)

Needed if you want to install as a PWA on iPhone (Safari requires HTTPS for "Add to Home Screen").

1. Get a free subdomain at <https://www.duckdns.org/> — sign in with Google/GitHub, claim `your-name.duckdns.org`, point it at your GCP external IP.
2. On the VM:
   ```bash
   sudo apt install -y caddy
   sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
   YOURNAME.duckdns.org {
     reverse_proxy localhost:80
   }
   EOF
   sudo systemctl restart caddy
   ```
3. Make sure HTTPS (port 443) is open in your GCP firewall (you ticked the box in Part 1).
4. Visit `https://YOURNAME.duckdns.org` — Caddy auto-issued a Let's Encrypt cert.

---

## Part 5 — Install on iPhone

1. Open the HTTPS URL in Safari.
2. Share button → **Add to Home Screen**.
3. Looks like a native app. Real-time feed updates work while it's open.

---

# Pushing changes from your laptop

This is the part you'll do often.

### Workflow with git (recommended)

```bash
# On your laptop
git commit -am "what changed" && git push

# On the VM
ssh mindful   # however you connect
cd ~/mindful && ./update.sh
```

`./update.sh` pulls latest code, rebuilds only what changed (Docker layer caching means typical updates take ~30 seconds), restarts services, and runs any new database migrations.

### Workflow without git

```bash
# On your laptop, sync the folder up
rsync -av --exclude node_modules --exclude .env mindful/ \
   <gcp-user>@<external-ip>:~/mindful/

# On the VM
ssh ...
cd ~/mindful && ./update.sh
```

### When something breaks

```bash
make logs           # tail all services
make logs-be        # tail just backend + workers
docker compose restart backend
docker compose restart workers

# Nuclear option: rebuild but keep data
docker compose down
./deploy.sh

# Truly start over (loses all posts/bookmarks):
make clean && ./deploy.sh
```

### Inspect the database

```bash
make shell           # opens psql
# inside psql:
\dt                  # list tables
SELECT name, unread_count FROM domains;
\q
```

---

# How Twitter works (and how to recover if it breaks)

Twitter is scraped in-process by the workers container using your session cookies — no extra service, no $100/mo API. Default poll cadence is 20 minutes per source, friendly to Twitter's rate limits so your cookies last weeks.

**If new tweets stop showing up:**
1. Check the worker logs: `make logs-be`. Look for `[twitter]` lines.
2. If you see `cookies not configured` — `TWITTER_AUTH_TOKEN`/`TWITTER_CT0` aren't set. Add them and `docker compose restart workers`.
3. If you see `unauthorized` / `403` / `401` — cookies have rotated. Re-extract from your browser (see "Twitter cookie setup" above) and restart workers.
4. If you see `rate limited` — increase `TWITTER_POLL_INTERVAL` to 1800 (30 min) or 3600 (1 hour) in `.env`, restart workers.

**Adjusting how often it polls:**

```bash
# backend/.env
RSS_POLL_INTERVAL=300        # 5 min
YOUTUBE_POLL_INTERVAL=900    # 15 min
TWITTER_POLL_INTERVAL=1200   # 20 min  ← lower = more real-time, higher = safer
```

Restart workers after changing: `docker compose restart workers`.

---

# Resource budget (so you know what's normal)

| Service     | RAM cap | Typical actual |
|-------------|---------|---------------|
| postgres    | 256 MB  | ~120 MB |
| redis       | 96 MB   | ~15 MB  |
| backend     | 256 MB  | ~80 MB  |
| workers     | 256 MB  | ~130 MB (incl. Twitter scraper) |
| frontend    | 64 MB   | ~10 MB  |
| **total**   | ~930 MB | ~360 MB |

Plus 2 GB swap as a safety net.

Twitter scraping adds only ~40 MB to the workers container (vs. ~250 MB for a self-hosted Nitter container), which is why the full stack now fits on 1 GB RAM.

`docker stats` on the VM shows you live consumption.

---

# Architecture snapshot

```
Your laptop  → edit code, push to git
     │
     ▼
GCP e2-micro VM (free, 24/7, US region)
  ├─ Docker compose
  │   ├─ postgres   (database, ~120 MB)
  │   ├─ redis      (pub/sub for real-time, ~15 MB)
  │   ├─ backend    (Express API + WebSocket :4000)
  │   ├─ workers    (RSS + Twitter scraper + YouTube + IMAP listener)
  │   └─ frontend   (nginx serving the PWA :80)
  └─ Caddy        (optional, HTTPS via Let's Encrypt)

External free services
  ├─ Gemini API     (TLDR + YouTube summaries; 1500 req/day)
  ├─ YouTube Data   (channel polling; 10k units/day)
  └─ Gmail          (dedicated newsletter inbox; IMAP)
```

Latency to your iPhone in India is ~250–300 ms from us-central1. Totally fine for a feed reader. WebSocket push works the same as locally — items appear the second they're ingested.

---

# Plan B — if GCP free signup also fails

GCP sometimes rejects Indian cards too. Fallbacks in order:

1. **Your old laptop at home + Cloudflare Tunnel** — fully free, no signup. Tell me and I'll write that variant.
2. **Hetzner CX11** — ~₹350/mo, German DC, smoothest paid path. Better hardware than GCP free.
3. **Fly.io free** — small VMs, requires CC.

You won't need to change the code for any of these; the docker-compose stack runs anywhere.
