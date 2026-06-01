import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { DomainIcon } from '../components/Icons.jsx';
import { typeLabel, VISIBLE_TYPES } from '../lib/labels.js';
import { SkeletonGrid } from '../components/Skeleton.jsx';

export default function Home() {
  const [domains, setDomains] = useState([]);
  const [typeCounts, setTypeCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [ds, tc] = await Promise.all([
        api.listDomains(),
        api.sourceCounts().catch(() => []),  // optional; tolerated if endpoint missing
      ]);
      setDomains(ds || []);
      setTypeCounts(tc || []);
      setError(null);
    } catch (e) {
      console.error('Home: failed to load', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  usePoll(load, 15000, []);

  if (loading) return <SkeletonGrid n={8} />;
  if (error)   return <div className="text-wood text-sm">Couldn't load: {error}</div>;

  // Build the "New Reads/Watches" row — one pill per visible source type,
  // ordered consistently. Pills appear whether or not there are unread items
  // (a zero-count pill is still useful: "yes, you have X sources").
  const countByType = Object.fromEntries((typeCounts || []).map(r => [r.type, r.unread_count]));
  const visibleTypes = VISIBLE_TYPES.filter(t => (countByType[t] || 0) >= 0); // keep all

  return (
    <div>
      <section className="mb-8 sm:mb-10">
        <h2 className="eyebrow text-muted mb-3 pb-2 border-b border-border">New Reads / Watches</h2>
        {/* Swiss collapses the tag borders; Wood/Bohemian space them into pills.
            overflow-hidden contains the 1px collapse offset so it can never
            cause sideways scroll on narrow phones. */}
        <div className="tag-row flex flex-wrap -mt-px overflow-hidden">
          {visibleTypes.map(t => {
            const count = countByType[t] || 0;
            return (
              <Link
                key={t}
                to={`/t/${t}`}
                className="tag group shrink-0 inline-flex items-center gap-2 border border-line -ml-px -mt-px px-3 py-2 text-xs font-bold tt-label tracking-eyebrow hover:bg-ink hover:text-bg transition-colors"
              >
                <span>{typeLabel(t)}</span>
                <span className={count > 0 ? 'text-wood group-hover:text-bg tabular-nums' : 'text-muted group-hover:text-bg tabular-nums'}>
                  {String(count).padStart(2, '0')}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Domain grid. Swiss: collapsed modular hairlines (container top/left +
          cell right/bottom). Wood/Bohemian override to gapped rounded cards. */}
      <div className="domain-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-line">
        {domains.map(d => (
          <Link
            key={d.id}
            to={`/d/${d.slug}`}
            className="domain-cell group relative min-w-0 bg-bg border-r border-b border-line aspect-square p-4 hover:bg-ink hover:text-bg transition-colors flex flex-col overflow-hidden"
          >
            <div className="text-wood group-hover:text-bg transition-colors">
              <DomainIcon name={d.icon} className="w-6 h-6" />
            </div>
            <div className="flex-1" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate tt-title">{d.name}</h2>
              <div className="text-xs text-muted group-hover:text-bg/70 mt-1 min-h-[1.1em] tabular-nums">
                {d.unread_count > 0 ? `${d.unread_count} new` : ''}
              </div>
            </div>
            {d.unread_count > 0 && (
              <span className="domain-badge absolute top-0 right-0 text-[10px] font-bold text-bg bg-wood px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums">
                {d.unread_count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
