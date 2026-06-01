import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typeLabel } from '../lib/labels.js';
import { BookmarkIcon, WeekendIcon } from '../components/Icons.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

// /library — everything saved across all domains: bookmarks + weekend.
// Tabs let you slice by which kind of save.
export default function Library() {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.libraryPosts()
       .then(r => setItems(r || []))
       .catch(e => console.warn(e))
       .finally(() => setLoading(false));
  }, []);

  const visible = tab === 'bookmark'
    ? items.filter(p => p.is_bookmarked)
    : tab === 'weekend'
    ? items.filter(p => p.is_weekend)
    : items;

  const TABS = [
    { key: 'all',      label: `All (${items.length})` },
    { key: 'bookmark', label: `Bookmarks (${items.filter(p=>p.is_bookmarked).length})` },
    { key: 'weekend',  label: `Weekend (${items.filter(p=>p.is_weekend).length})` },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Home</Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none mb-6 break-words">Library</h1>

      <div className="flex gap-0 border-b-2 border-line mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-bold tt-label tracking-eyebrow border-b-2 -mb-0.5 transition-colors shrink-0 ${
              tab === t.key ? 'border-wood text-wood' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList n={3} />
      ) : visible.length === 0 ? (
        <EmptyState kind="library-empty" />
      ) : (
        <ul className="space-y-2">
          {visible.map(p => (
            <li key={p.id}>
              <button
                onClick={() => navigate(`/d/${p.domain_slug}/p/${p.id}`)}
                className="w-full text-left bg-elev border border-border p-4 hover:border-ink transition-colors"
              >
                <div className="eyebrow text-wood mb-1.5 flex items-center gap-2">
                  <span>{typeLabel(p.source_type)} / {p.source_name || p.author || ''}</span>
                  <span className="flex items-center gap-1">
                    {p.is_bookmarked && <BookmarkIcon filled className="w-3 h-3" />}
                    {p.is_weekend    && <WeekendIcon  filled className="w-3 h-3" />}
                  </span>
                </div>
                {p.title && <div className="font-bold leading-snug tracking-tight mb-1">{p.title}</div>}
                {p.tldr && <div className="text-sm text-muted line-clamp-2">{p.tldr}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
