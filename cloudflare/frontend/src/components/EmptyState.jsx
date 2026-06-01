// Custom empty-state illustrations + Gen-Z microcopy. Small monoline SVGs
// in the same wood/cream language as the rest of the app.

export function EmptyState({ kind = 'caught-up' }) {
  const C = COPY[kind] || COPY['caught-up'];
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-wood mb-5">{C.art}</div>
      <h3 className="font-bold text-lg tracking-tight mb-1">{C.title}</h3>
      <p className="text-sm text-muted max-w-xs">{C.line}</p>
    </div>
  );
}

// --- Illustrations -------------------------------------------------------
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' };

const ArtBookClosed = () => (
  <svg viewBox="0 0 120 120" className="w-28 h-28" {...stroke} aria-hidden="true">
    <rect x="32" y="22" width="56" height="76" rx="3" />
    <line x1="42" y1="22" x2="42" y2="98" />
    <path d="M62 22 L62 50 L70 44 L78 50 L78 22" />
  </svg>
);
const ArtCoffeeBeans = () => (
  <svg viewBox="0 0 120 120" className="w-28 h-28" {...stroke} aria-hidden="true">
    <ellipse cx="50" cy="55" rx="14" ry="9" transform="rotate(-30 50 55)" />
    <path d="M40 49 Q50 60 60 51" transform="rotate(-30 50 55)" />
    <ellipse cx="74" cy="74" rx="14" ry="9" transform="rotate(20 74 74)" />
    <path d="M64 68 Q74 79 84 70" transform="rotate(20 74 74)" />
  </svg>
);
const ArtSearchEmpty = () => (
  <svg viewBox="0 0 120 120" className="w-28 h-28" {...stroke} aria-hidden="true">
    <circle cx="50" cy="50" r="26" />
    <line x1="70" y1="70" x2="92" y2="92" />
    <line x1="40" y1="50" x2="60" y2="50" />
  </svg>
);
const ArtLibrary = () => (
  <svg viewBox="0 0 120 120" className="w-28 h-28" {...stroke} aria-hidden="true">
    <rect x="22" y="28" width="14" height="64" />
    <rect x="40" y="42" width="14" height="50" />
    <rect x="58" y="22" width="14" height="70" />
    <rect x="76" y="50" width="14" height="42" />
    <line x1="14" y1="92" x2="106" y2="92" strokeWidth="2.4" />
  </svg>
);
const ArtNoSources = () => (
  <svg viewBox="0 0 120 120" className="w-28 h-28" {...stroke} aria-hidden="true">
    <rect x="30" y="30" width="60" height="60" rx="6" strokeDasharray="3 4" />
    <line x1="60" y1="48" x2="60" y2="72" />
    <line x1="48" y1="60" x2="72" y2="60" />
  </svg>
);

const COPY = {
  // domain feed, "Unread" tab, nothing left
  'caught-up': {
    art: <ArtCoffeeBeans />,
    title: "you're caught up.",
    line: 'go touch grass. or wait for the next cron tick.',
  },
  // domain feed, "Read" tab
  'nothing-read': {
    art: <ArtBookClosed />,
    title: 'nothing read here yet.',
    line: 'open something. mark it read. it shows up here.',
  },
  // domain feed, "Bookmarked" tab
  'no-bookmarks': {
    art: <ArtBookClosed />,
    title: 'no bookmarks.',
    line: "you'll save something. it'll live here.",
  },
  // domain feed, "Weekend" tab
  'no-weekend': {
    art: <ArtBookClosed />,
    title: 'nothing for the weekend.',
    line: 'save the long stuff here. read it sunday.',
  },
  // search returned nothing
  'search-empty': {
    art: <ArtSearchEmpty />,
    title: 'no matches.',
    line: 'try fewer words. spelling counts.',
  },
  // library page, nothing saved
  'library-empty': {
    art: <ArtLibrary />,
    title: 'your library is empty.',
    line: 'bookmark something. it shows up here, all domains, one list.',
  },
  // sources page, no sources yet
  'no-sources': {
    art: <ArtNoSources />,
    title: 'no sources yet.',
    line: 'add one above. blog url, x handle, yt channel — whatever.',
  },
};
