// Minimal inline icons so we don't pull in a heavy icon library.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const SunIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
export const MoonIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);
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

// Domain icons. Kept simple — only <circle>, <rect>, <line>, and <path L>
// commands. No <ellipse>, no Q/A curves: those have rendered inconsistently
// on older iOS Safari builds. All icons render identically on desktop and
// iPhone now.
export const DomainIcon = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'football':
      // Soccer ball — circle + central pentagon. Cleaner than spokes.
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5 L16 10.5 L14.5 15 L9.5 15 L8 10.5 Z" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M12 3 L13.8 7.7 L18.5 9.5 L13.8 11.3 L12 16 L10.2 11.3 L5.5 9.5 L10.2 7.7 Z" />
          <path d="M19 15 L19.9 17.1 L22 18 L19.9 18.9 L19 21 L18.1 18.9 L16 18 L18.1 17.1 Z" />
        </svg>
      );
    case 'shopping':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M6 7 L18 7 L17 20 L7 20 Z" />
          <path d="M9 7 L9 5 L15 5 L15 7" />
        </svg>
      );
    case 'cube':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M21 7.5 L12 2.5 L3 7.5 L3 16.5 L12 21.5 L21 16.5 Z" />
          <path d="M3 7.5 L12 12.5 L21 7.5" />
          <line x1="12" y1="21.5" x2="12" y2="12.5" />
        </svg>
      );
    case 'circle':   // General — pure focal dot
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'globe':    // Geopolitics — globe with equator + a meridian
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <path d="M12 3 L8 7 L8 17 L12 21" />
          <path d="M12 3 L16 7 L16 17 L12 21" />
        </svg>
      );
    case 'flag':     // India — flag on a pole
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <line x1="5" y1="3" x2="5" y2="21" />
          <path d="M5 5 L19 5 L16 9 L19 13 L5 13 Z" />
        </svg>
      );
    case 'dots':     // Miscellaneous — three dots
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="6"  cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
};
