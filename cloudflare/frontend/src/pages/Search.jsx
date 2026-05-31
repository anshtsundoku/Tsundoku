import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { SearchIcon } from '../components/Icons.jsx';
import { typeLabel } from '../lib/labels.js';
import { EmptyState } from '../components/EmptyState.jsx';

// /search — full-text across post titles, TLDRs, and bodies.
// Debounced as you type; results are clickable to the post detail in
// whichever domain the post belongs to.
export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounce 250ms so we don't hammer the worker on every keystroke.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    setTouched(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.searchPosts(q);
        setResults(r || []);
      } catch (e) { console.warn(e); setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="text-sm text-muted hover:text-ink">← Home</Link>

      <div className="relative mt-3 mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder="search across everything you've saved"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-elev border border-border rounded-xl pl-10 pr-3 py-3 text-ink outline-none focus:border-wood/60"
        />
      </div>

      {searching && q.length >= 2 && (
        <div className="text-muted text-sm">searching…</div>
      )}

      {!searching && touched && q.length >= 2 && results.length === 0 && (
        <EmptyState kind="search-empty" />
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map(p => (
            <li key={p.id}>
              <button
                onClick={() => navigate(`/d/${p.domain_slug}/p/${p.id}`)}
                className="w-full text-left bg-elev border border-border rounded-xl p-4 hover:border-wood/40 transition"
              >
                <div className="text-xs uppercase tracking-wider text-wood mb-1">
                  {typeLabel(p.source_type)} · {p.source_name || p.author || ''}
                </div>
                {p.title && <div className="font-bold leading-snug mb-1">{p.title}</div>}
                {p.tldr && <div className="text-sm text-muted line-clamp-2">{p.tldr}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
