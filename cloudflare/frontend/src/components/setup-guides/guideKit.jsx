// Shared presentational pieces for the inline setup guides. Keeps the three
// guides visually consistent (numbered counter circles, url pills, contact).

const CONTACT_EMAIL = 'anshdwiv5@gmail.com';

export function GuideShell({ heading, sub, children, note }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4 mb-3">
      <h4 className="text-ink font-bold tracking-tight lowercase">{heading}</h4>
      {sub && <p className="text-muted text-xs italic mt-0.5">{sub}</p>}
      <ol className="mt-3 space-y-2.5">{children}</ol>
      {note && <p className="text-muted text-xs mt-3 leading-relaxed">{note}</p>}
      <p className="text-muted text-xs mt-3">
        questions? <a href={`mailto:${CONTACT_EMAIL}`} className="text-wood hover:underline">{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}

export function Step({ n, children }) {
  return (
    <li className="flex gap-2.5 text-sm text-muted leading-relaxed">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-wood text-white text-xs font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

// Monospace pill for external URLs.
export function Url({ children }) {
  return (
    <span className="font-mono bg-wood/10 text-wood px-1.5 py-0.5 rounded text-xs break-all">{children}</span>
  );
}

// Inline link that opens in a new tab.
export function GuideLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-wood underline hover:text-ink transition-colors">
      {children}
    </a>
  );
}
