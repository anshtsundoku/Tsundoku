// Source-type short labels for the worker side (notifications, etc.).
// Mirrors the frontend's lib/labels.js — kept separate so backend/frontend
// don't share imports across the build boundary.

const LABEL = {
  website:    'Blog',
  rss:        'Blog',
  twitter:    'X',
  youtube:    'YT',
  newsletter: 'Newsletter',
  podcast:    'Podcast',
  gmail:      'Gmail',
};

export function typeShort(type) {
  return LABEL[type] || type || '';
}
