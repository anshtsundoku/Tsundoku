// Single source of truth for the privacy policy + terms. Bump LAST_UPDATED and
// both pages reflect it. Content is rendered by the minimal markdown renderer
// in components/Markdown.jsx.

export const LAST_UPDATED = 'june 2, 2026';

export const PRIVACY_MD = `# privacy

tsundoku is a personal project, not a business. one person runs it. this page explains what we collect and what happens to it.

## what we collect

when you sign in:
- your email, name, and profile picture from google. used to identify you in the app.
- a session token in a cookie so you don't have to sign in every time. expires in 30 days.

when you use the app:
- the sources you add (urls, channels, accounts)
- the posts those sources produce (titles, content, links)
- your bookmarks, weekend saves, highlights, and read state
- when you add a credential (api keys, x cookies), we store it encrypted

we do not collect analytics. no third-party tracking. no ads. ever.

## where it lives

everything is stored on cloudflare's d1 database — a sqlite instance running inside cloudflare's network. credentials are encrypted with aes-gcm before they hit the database.

## who can see it

just you and the person hosting tsundoku. nothing is shared, sold, or surfaced to third parties.

## third-party services

your data passes through these services when you use the app:
- google identity services (for sign-in)
- gemini api (for summarising posts, if you've connected it)
- youtube data api (for finding new videos, if you've connected it)
- x.com (we use your cookies to fetch posts, if you've connected it)

each has its own privacy policy. tsundoku doesn't have insight into what they do with the requests we make on your behalf.

## cookies

one cookie: your session token. http-only, secure, samesite=lax. expires in 30 days.

## your rights

you can delete your account from settings at any time. that wipes all your data within seconds. nothing recoverable, nothing retained.

if you want a copy of your data before deleting, ask the host.

## changes

if anything material changes, the "last updated" date below moves. you'll see the new version next time you open the app.

## contact

questions, gripes, or breaches: anshdwiv5@gmail.com

last updated: ${LAST_UPDATED}
`;

export const TERMS_MD = `# terms

tsundoku is a free personal tool offered as-is. by signing in, you accept these terms.

## what tsundoku does

it pulls content from sources you connect (blogs, youtube, x, newsletters) and surfaces it in one calm feed. it is not a publisher, not a search engine, not a social network.

## what you can do

read. bookmark. highlight. share. nothing else is implemented.

## what you can't do

- abuse the service or try to compromise it
- use it to scrape content at scale or violate any third party's terms (youtube, x, etc.)
- impersonate someone else
- attempt to access accounts other than your own

## availability

tsundoku may go offline at any time without notice. the host does this in their spare time. there is no uptime guarantee. no refunds, because nothing was paid.

## your data

your data is yours. delete your account in settings and it's gone. see the privacy policy.

## changes to these terms

if material changes happen, the "last updated" date below moves. continuing to use the app means you accept the new terms.

## contact

anshdwiv5@gmail.com

last updated: ${LAST_UPDATED}
`;
