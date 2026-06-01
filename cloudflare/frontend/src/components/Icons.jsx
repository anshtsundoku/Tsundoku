// Minimal inline icons for the app chrome (nav, buttons). Domain icons are
// rendered from Lucide — see DomainIcon at the bottom of this file.
import { icons as lucideIcons } from 'lucide-react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const HomeIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>
);
export const GearIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const BookmarkIcon = ({ filled, ...p }) => (
  <svg viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);
export const CheckIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M20 6L9 17l-5-5" /></svg>
);
export const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
export const HighlightIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M9 11l-6 6v4h4l6-6M14 4l6 6-9 9H5v-6z" />
  </svg>
);
export const ExternalIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
);
export const XIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
export const SearchIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20 L16.65 16.65" />
  </svg>
);
export const LibraryIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M4 5h3v15H4z M9 5h3v15H9z M14 6l3 -0.5 3 14.5 -3 0.5z" />
  </svg>
);
export const ShareIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 3 L12 15 M8 7 L12 3 L16 7 M5 12 L5 19 a2 2 0 0 0 2 2 L17 21 a2 2 0 0 0 2 -2 L19 12" />
  </svg>
);
export const WeekendIcon = ({ filled, ...p }) => (
  <svg viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <line x1="3.5" y1="10" x2="20.5" y2="10" />
    <line x1="8"  y1="3" x2="8"  y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </svg>
);

// Domain icons are now Lucide icons, selected via the IconPicker. The `icon`
// column stores a Lucide icon name (kebab-case, e.g. "newspaper", "globe").
//
// Legacy rows created before Phase 3 still carry the old custom keys; map those
// to their closest Lucide equivalent so existing domains keep a sensible icon
// until the user re-picks one.
const LEGACY_ALIASES = {
  football: 'Volleyball',
  sparkle:  'Sparkles',
  shopping: 'ShoppingBag',
  cube:     'Box',
  dots:     'Ellipsis',
  circle:   'Circle',
  globe:    'Globe',
  flag:     'Flag',
};

// "arrow-right" | "ArrowRight" | "newspaper" → "ArrowRight" (a lucideIcons key).
function toPascal(name) {
  return String(name)
    .trim()
    .replace(/[-_\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// Resolve a stored icon name to a Lucide component, or null if unknown.
export function resolveLucideIcon(name) {
  if (!name) return null;
  if (lucideIcons[name]) return lucideIcons[name];                       // already PascalCase
  if (LEGACY_ALIASES[name] && lucideIcons[LEGACY_ALIASES[name]]) {       // legacy custom key
    return lucideIcons[LEGACY_ALIASES[name]];
  }
  const pascal = toPascal(name);
  return lucideIcons[pascal] || null;
}

// Same prop API as before ({ name, className }) so callers don't change. Falls
// back to a neutral Lucide glyph when the name doesn't resolve.
export const DomainIcon = ({ name, className = 'w-6 h-6' }) => {
  const Cmp = resolveLucideIcon(name) || lucideIcons.Hash;
  return <Cmp className={className} aria-hidden="true" />;
};
