# tsundoku — x sync (browser extension)

one-click x.com cookie sync for [tsundoku](https://tsundoku-e0v.pages.dev). x
has no public api, so tsundoku reads your timeline using your own x.com session
cookies. this extension keeps those cookies fresh automatically — no devtools
copy-paste every few weeks.

manifest v3. works on chromium browsers (chrome, edge, brave, arc) and, with
minimal manifest tweaks, firefox.

## install (unpacked, dev mode)

1. open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. turn on **developer mode** (top-right toggle).
3. click **load unpacked**.
4. select this `/extension` folder.
5. the tsundoku icon appears in your toolbar.

## pairing

1. sign in to tsundoku in the same browser.
2. go to **settings → browser extensions** and open the pairing page
   (`/extension-pair`).
3. click **approve and connect**. the page mints a long-lived token and hands
   it to the extension.
4. the popup flips to **connected as &lt;your email&gt;**.

once paired, the extension watches your x.com `auth_token` and `ct0` cookies and
pushes them to tsundoku whenever they change (debounced), plus an hourly safety
re-sync. the cookies are encrypted on the server before they touch the database.

## how it works

- `background.js` — service worker. watches cookie changes + the hourly alarm,
  posts cookies to `POST /api/extension/twitter-cookies` with the pairing bearer
  token. on a `401` it marks the pairing invalid and stops until you re-pair.
- `pair.js` — content script on `tsundoku-e0v.pages.dev/extension-pair*`. relays
  the token from the page to the background worker.
- `popup.*` — status + manual **sync now** / **disconnect**.

your token lives only in `chrome.storage.local`. revoke it any time from
**settings → browser extensions → revoke**, or with **disconnect** in the popup.

## icons

> TODO: `icons/*.png` are placeholder solid wood-color squares. replace them
> with the real tsundoku monoline book icon (16 / 32 / 48 / 128 px) before any
> public release.

## publishing to the chrome web store (manual — not automated)

1. create a $5 developer account at
   `chrome.google.com/webstore/devconsole`.
2. zip the `/extension` folder (the `README.md` is fine to include).
3. upload, fill in the store listing, and submit for review.
4. first review typically takes 3–7 days.
