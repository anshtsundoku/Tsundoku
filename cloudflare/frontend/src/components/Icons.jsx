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

// Domain icons.
export const DomainIcon = ({ name, className = 'w-6 h-6' }) => {
  switch (name) {
    case 'football':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3l3 3-1 4-4 0-1-4z M12 21v-4 M3 12h4 M21 12h-4 M5 18l3-2 M19 18l-3-2" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
        </svg>
      );
    case 'shopping':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M6 7h12l-1 13H7zM9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'cube':
      return (
        <svg viewBox="0 0 24 24" {...base} className={className}>
          <path d="M21 7.5l-9-5-9 5v9l9 5 9-5z M3 7.5l9 5 9-5 M12 22V12" />
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
