// Single source of truth for how source types are labelled in the UI.
//
// Backend type values are unchanged (website, twitter, youtube, newsletter,
// podcast, gmail, rss) — we just rename them in the UI without a migration.
// 'gmail' is kept here for legacy posts but is no longer exposed in the
// add-source form.

export const TYPE_LABEL = {
  website:    'Blog',
  rss:        'Blog',
  twitter:    'X',
  youtube:    'YT',
  newsletter: 'Newsletter',
  podcast:    'Podcast',
  gmail:      'Gmail',
};

export function typeLabel(type) {
  return TYPE_LABEL[type] || type;
}

// Order shown in the "New Reads/Watches" row + the add-source form.
export const VISIBLE_TYPES = ['website', 'twitter', 'youtube', 'newsletter', 'podcast'];
