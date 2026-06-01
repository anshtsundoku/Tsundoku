# Deploy Tsundoku — final guide

Production-ready, $0/month, runs on Cloudflare's free tier. Everything below uses the GitHub repo at <https://github.com/anshtsundoku/Tsundoku>.

```
You change code → push to GitHub → Pages auto-rebuilds the frontend.
You run `npm run deploy` once → Worker + cron triggers go live.
```

That's it. Set it up once, then iterate by pushing.

---

## What runs where

| Piece               | Where                          | Free tier         |
|---------------------|--------------------------------|-------------------|
| PWA (frontend)      | Cloudflare Pages               | unlimited static + 500 builds/mo |
| API + ingestion     | Cloudflare Worker (single)     | 100 K req/day     |
| Database            | Cloudflare D1                  | 5 GB, 5 M reads, 100 K writes /day |
| Cron triggers       | Cloudflare Workers             | unlimited         |
| AI summaries        | Google Gemini API              | 1500 req/day      |
| YouTube polling     | YouTube Data API v3            | 10 K units/day    |
| Newsletter ingest   | Gmail API                      | effectively ∞     |
| Twitter ingest      | x.com web API (your cookies)   | n/a               |
| Auth (single-user)  | Cloudflare Access              | up to 50 users    |

Total monthly cost: **$0**.

---

## Step 0 — Push the code to your repo

If you haven't already:

```bash
# In the project root, on your laptop
git init
git remote add origin https://github.com/anshtsundoku/Tsundoku.git
git add .
git commit -m "Initial Tsundoku scaffold"
git branch -M main
git push -u origin main
```

If you cloned a starter or unpacked the tarball, just commit and push.

---

## Step 1 — Cloudflare account + wrangler (3 min)

1. You already have a Cloudflare account. Sign in at <https://dash.cloudflare.com>.

2. Install the CLI on your laptop:

   ```bash
   npm install -g wrangler
   wrangler login
   ```

   Browser tab opens — click **Allow**. CLI prints `Successfully logged in.`

---

## Step 2 — Create the D1 database (1 min)

```bash
cd cloudflare/worker
wrangler d1 create tsundoku
```

Output looks like:

```
✅ Successfully created DB 'tsundoku' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "tsundoku"
database_id = "abc123de-4567-8901-...."
```

**Copy that `database_id` line**, open `cloudflare/worker/wrangler.toml`, replace `REPLACE_WITH_YOUR_D1_ID` with that id, save.

Then apply the schema + the optional seed:

```bash
npm install
npm run migrate:remote      # creates tables + default 4 domains + your user
npm run seed:remote         # optional: a few sample posts so the UI isn't empty
```

You should see two "Executed X commands in Y ms" success messages.

---

## Step 3 — Get the three API keys

### 3a. Gemini

1. Open <https://aistudio.google.com/app/apikey> (signed in as `ansh.tsundoku@gmail.com`).
2. Click **Create API key** (top-right) → **Create API key in new project**.
3. Copy the `AIza...` value.

### 3b. YouTube Data API v3

1. Open <https://console.cloud.google.com> (same Google account).
2. Top bar → project picker → **New Project** → name `tsundoku` → Create.
3. Search bar at top → "YouTube Data API v3" → **Enable**.
4. Left sidebar → **Credentials** → **+ Create credentials** → **API key**. Copy it.
5. Optional: click the pencil to restrict the key to "YouTube Data API v3" only.

### 3c. Gmail (for newsletter ingestion)

This one takes ~10 min but you only do it once.

1. In Google Cloud Console (same `tsundoku` project), search → enable **Gmail API**.
2. Left sidebar → **OAuth consent screen** → **External** → fill in:
   - App name: `Tsundoku`
   - User support email: your address
   - Developer contact: your address
   - Click **Save and continue** through Scopes (skip), then **Test users** → **+ Add users** → add `ansh.tsundoku@gmail.com` → Save → **Back to dashboard**. (No need to publish.)
3. **Credentials** → **+ Create credentials** → **OAuth client ID** → application type **Desktop app** → name "Tsundoku Local" → Create. Note **Client ID** and **Client secret**.
4. Generate a refresh token using Google's OAuth Playground:
   - Go to <https://developers.google.com/oauthplayground>.
   - Top-right ⚙️ icon → tick **Use your own OAuth credentials** → paste the Client ID + Secret.
   - Left list → expand **Gmail API v1** → tick `https://www.googleapis.com/auth/gmail.readonly`.
   - Click **Authorize APIs** → sign in as `ansh.tsundoku@gmail.com` → Allow.
   - Step 2 → click **Exchange authorization code for tokens** → copy the **refresh_token** value.

You now have three Gmail values: Client ID, Client Secret, Refresh Token.

---

## Step 4 — Get the Twitter cookies (5 min)

1. Open <https://x.com> in Chrome and log in. (Recommended: a secondary Twitter account, not your main.)
2. Press `F12` → **Application** tab → **Cookies** → `https://x.com`.
3. Find these two cookies and copy the **Value** column:
   - `auth_token`
   - `ct0`

Keep them handy for the next step.

---

## Step 5 — Set the Worker secrets

Back on your terminal, in `cloudflare/worker`:

```bash
wrangler secret put GEMINI_API_KEY
# paste the AIza... value, press Enter

wrangler secret put YOUTUBE_API_KEY
# paste, Enter

wrangler secret put GMAIL_CLIENT_ID
wrangler secret put GMAIL_CLIENT_SECRET
wrangler secret put GMAIL_REFRESH_TOKEN

wrangler secret put TWITTER_AUTH_TOKEN
wrangler secret put TWITTER_CT0

# (Optional) Lock the admin endpoints with a random token:
wrangler secret put ADMIN_TOKEN
# generate one with:  openssl rand -hex 24
```

Each prompt accepts the value once, encrypted-at-rest on Cloudflare's servers. The CLI never echoes the value back.

---

## Step 6 — Deploy the Worker

```bash
npm run deploy
```

Wrangler builds and publishes. You'll see:

```
✨ Deployed tsundoku-api triggers (2.34 sec)
   https://tsundoku-api.YOURNAME.workers.dev
   schedule: */5 * * * *
   schedule: */20 * * * *
   schedule: */15 * * * *
   schedule: */10 * * * *
```

Note that URL — call it `YOUR_WORKER_URL`.

Verify:

```bash
curl https://tsundoku-api.YOURNAME.workers.dev/api/health
# → {"ok":true,"app":"tsundoku"}

curl https://tsundoku-api.YOURNAME.workers.dev/api/admin/status
# → JSON with your 4 domains and their counts
```

---

## Step 7 — Point the frontend at the Worker

The frontend calls the Worker cross-origin (the Worker is CORS-enabled), so there's no `_redirects` proxy to edit — just one constant.

1. Open `cloudflare/frontend/src/lib/api.js`.
2. Replace the `BASE` URL with your real Worker URL from Step 6 (keep the trailing `/api`).
3. Commit and push:

   ```bash
   git commit -am "Point Pages at Worker"
   git push
   ```

---

## Step 8 — Deploy the Pages site

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**.
2. Authorize Cloudflare on GitHub → pick `anshtsundoku/Tsundoku`.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** `cd cloudflare/frontend && npm install && npm run build`
   - **Build output directory:** `cloudflare/frontend/dist`
   - **Root directory (advanced):** leave blank
4. Click **Save and Deploy**.

After ~2 minutes Pages shows the build succeeded and gives you `https://tsundoku.pages.dev` (or `<project>.pages.dev`).

Open it. You should see:
- The Tsundoku header with the book icon
- 4 domain cards (Football, AI, Consumerism, Product)
- Sample posts inside each (if you ran `npm run seed:remote`)

If the UI loads but `/api` calls 404, double-check `_redirects` has the correct Worker URL.

---

## Step 9 — Lock the site to just you (recommended, 2 min)

By default `tsundoku.pages.dev` is public. To make it your-eyes-only, put Cloudflare Access in front:

1. Cloudflare dashboard → **Zero Trust** (left sidebar). Choose a free team name on first use.
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name: `Tsundoku`, Session duration: `1 month`.
4. Application domain → pick your `tsundoku.pages.dev` (or your custom domain). Save.
5. **Policy** → name it `Owner`, action `Allow`, **Include** → **Emails** → add `ansh.tsundoku@gmail.com` (and any other addresses you want to allow).
6. Save and continue through the remaining steps with defaults.

Now visiting the site sends you through a Google email login. Once authenticated, you're in for a month. The Worker is still publicly reachable on its own URL, but the Pages proxy is gated.

If that feels heavy and you'd rather skip auth for now, the site is single-user but functionally public — only you know the URL. Just don't share it publicly.

---

## Step 10 — Install on your iPhone

1. Open `https://tsundoku.pages.dev` in Safari. Sign in via Cloudflare Access if you set it up.
2. Share button → **Add to Home Screen**.
3. The book icon goes on your home screen. Tap it — opens fullscreen, looks like a native app.

---

## Step 11 — Add your real sources + verify

1. Open the app, top-right gear icon → **Sources**.
2. Add a few of your favorites:
   - Type: Website, identifier: `https://stratechery.com` (auto-discovers RSS)
   - Type: Twitter, identifier: `FabrizioRomano` (no @)
   - Type: YouTube, identifier: `@YannicKilcher`
   - Type: Newsletter, identifier: `newsletter@stratechery.com` (or just `substack.com` as catch-all)
3. **Trigger ingestion now** (don't wait for cron):

   ```bash
   curl -X POST https://tsundoku-api.YOURNAME.workers.dev/api/admin/trigger-ingest \
     -H "x-admin-token: $YOUR_ADMIN_TOKEN"
   ```

   (Skip the `-H` line if you didn't set `ADMIN_TOKEN`.)

4. Tail the Worker logs while it runs:

   ```bash
   wrangler tail
   ```

   You should see `[rss] ... ok`, `[twitter] ... ok`, etc. Items show up in the app feed within ~30 seconds of ingestion.

---

# Workflow after the first deploy

This is what your day-to-day looks like.

### Change frontend code

```bash
# edit files in cloudflare/frontend/...
git commit -am "tweak"
git push
# Pages auto-rebuilds. ~2 min later it's live.
```

### Change Worker / backend code

```bash
# edit files in cloudflare/worker/src/...
cd cloudflare/worker
npm run deploy           # ~5s
git commit -am "..."; git push     # keep history in sync
```

### Database schema change

```bash
# Write a new migrations/0003_xxx.sql with idempotent ALTERs
wrangler d1 execute tsundoku --remote --file=migrations/0003_xxx.sql
```

### See what's happening

```bash
wrangler tail                      # live worker logs
curl YOUR_WORKER_URL/api/admin/status   # quick health snapshot
```

### Re-extract Twitter cookies (every few weeks)

When tweets stop showing up, `wrangler tail` will log `[twitter] ... 401/403`. Re-grab the cookies (Step 4) and:

```bash
wrangler secret put TWITTER_AUTH_TOKEN
wrangler secret put TWITTER_CT0
# no redeploy needed; new ticks pick them up
```

---

# Troubleshooting

**Pages build fails.** Open the build log on the Pages dashboard. 9/10 times it's `npm install` failing — fix is usually a missing dependency in `package.json`. Don't change Node version; Pages defaults to 20 which is correct.

**`/api/health` returns 404 on the Pages URL.** `_redirects` is wrong. Edit `cloudflare/frontend/_redirects`, push, wait for the rebuild. The Worker URL should match exactly what Step 6 printed.

**Ingestion doesn't produce posts.** Check:
1. `wrangler tail` — what's the worker actually doing?
2. `/api/admin/status` — do you have active sources?
3. Cron only runs after the first 5-min mark; trigger manually via `/api/admin/trigger-ingest` to test.

**Twitter shows `401 Unauthorized` in tail.** Cookies rotated. Re-extract (Step 4) and re-secret.

**Gemini errors with `403 / API key not valid`.** Either the key is wrong, or the Generative Language API is disabled on that project. Fix at <https://aistudio.google.com/app/apikey>.

**D1 queries fail with `no such table`.** You didn't run `npm run migrate:remote`. Re-run it.

**Pages PWA install on iPhone doesn't show the book icon.** Force-refresh: long-press the home-screen icon → Remove → reinstall. iOS aggressively caches the manifest.

---

That's everything. Total setup time on a fresh machine: ~30 minutes including the OAuth dance. Total ongoing cost: $0.
