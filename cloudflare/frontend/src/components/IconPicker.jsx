import { useEffect, useMemo, useRef, useState } from 'react';
import { icons as lucideIcons } from 'lucide-react';
import { XIcon, SearchIcon } from './Icons.jsx';

// How many icons to render at once. Lucide ships ~1,500 icons; instantiating
// every React component on mount would be wasteful, so we only render the
// visible slice of the (filtered) list.
const PAGE = 200;

// "ArrowRight" → "arrow-right", "Building2" → "building-2".
function pascalToKebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase();
}

// Build the icon catalogue once: [{ kebab, Cmp }]. Just metadata + component
// references — nothing is rendered until it lands in the visible grid.
const CATALOGUE = Object.keys(lucideIcons)
  .map(pascal => ({ kebab: pascalToKebab(pascal), Cmp: lucideIcons[pascal] }))
  .sort((a, b) => a.kebab.localeCompare(b.kebab));

const norm = s => String(s || '').replace(/[-\s]/g, '').toLowerCase();

export default function IconPicker({ value, onChange, onClose }) {
  const [raw, setRaw] = useState('');
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Debounce the search input by 100ms.
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw), 100);
    return () => clearTimeout(t);
  }, [raw]);

  // Focus the search field + close on Escape.
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return CATALOGUE;
    return CATALOGUE.filter(i => norm(i.kebab).includes(q));
  }, [query]);

  const visible = filtered.slice(0, PAGE);
  const hidden = filtered.length - visible.length;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="surface bg-bg border border-border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <SearchIcon className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder="search 1,500 icons…"
            className="flex-1 min-w-0 bg-transparent text-ink placeholder:text-muted outline-none text-sm"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink shrink-0"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {visible.length === 0 ? (
            <div className="text-sm text-muted text-center py-12">
              no icons match “{query}”
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {visible.map(({ kebab, Cmp }) => {
                const selected = kebab === value;
                return (
                  <button
                    key={kebab}
                    type="button"
                    title={kebab}
                    onClick={() => { onChange?.(kebab); onClose?.(); }}
                    className={`aspect-square flex items-center justify-center text-ink hover:bg-elev transition-colors ${
                      selected ? 'ring-2 ring-wood' : ''
                    }`}
                  >
                    <Cmp className="w-5 h-5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {hidden > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted">
            showing first {PAGE} of {filtered.length} — keep typing to narrow it down
          </div>
        )}
      </div>
    </div>
  );
}
