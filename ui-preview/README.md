# Mindful — UI preview

A standalone single-file preview of the Mindful app. No backend, no API keys, no build step. Mock content across all four domains, all interactions work, your clicks persist in localStorage.

## Open it

Just double-click `mindful-preview.html` — it opens in your default browser and works offline.

## Put it on a public URL (so you can open it on your phone)

Three options, in order of ease:

### Option 1 — Netlify Drop (literally drag-and-drop, ~30 seconds)

1. Go to <https://app.netlify.com/drop>.
2. Drag `mindful-preview.html` (or this whole `ui-preview` folder) onto the page.
3. You get a URL like `https://crispy-jellybean-12345.netlify.app/mindful-preview.html`.

No account required to publish; if you want the URL to stay forever, click "Claim this site" and sign up with email — no card.

### Option 2 — Cloudflare Pages (you already have an account)

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create application** → **Pages** → **Upload assets**.
2. Project name: `mindful-preview`. Click Create.
3. Drag the `ui-preview` folder onto the upload area. Click Deploy.
4. You get `https://mindful-preview.pages.dev`.

### Option 3 — Surge.sh (CLI, fastest if you have Node installed)

```bash
npm install -g surge
cd ui-preview
surge
# follow prompts; pick any subdomain (e.g. mindful-preview.surge.sh)
```

## What works in the preview

- All four domains with unread counts on the home screen
- Unread / Read / Bookmarked tabs per domain
- Mark read, bookmark, remove-from-feed
- Click any post to open the detail sheet
- **Select any text in a post** → a "Highlight" button appears bottom-right → tap it to save
- Highlights persist; saved ones show as amber underlines in the body and listed at the bottom of the sheet
- Add a new source from the Sources page (type, domain, identifier hint)
- Dark / light theme toggle (top right)
- Everything persists in localStorage between reloads

## What's mocked

- Posts don't actually update in real time (no backend)
- Adding a new source doesn't fetch content
- Marking read/bookmark doesn't sync across devices

This is purely a visual + interaction validation tool. The real app uses the exact same UI but with live data flowing in from the backend.

## Reset

There's a "Reset preview data" link at the bottom of the Sources page. Wipes localStorage and reloads the defaults.
