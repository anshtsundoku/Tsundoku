import { useState } from 'react';

// "how do I get this?" link + collapsible guide. Default closed. The guide
// renders above the input it documents (the parent places this component there).
export default function GuideToggle({ children, label = 'how do I get this?' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-wood text-xs hover:underline"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 16 16" className="w-3 h-3 transition-transform" aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        {open ? 'hide guide' : label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
