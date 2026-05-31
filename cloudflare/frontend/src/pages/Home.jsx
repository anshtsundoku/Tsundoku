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
      <section className="mb-6 sm:mb-8">
        <h2 className="text-xs uppercase tracking-wider text-muted font-bold mb-2 ml-0.5">New Reads / Watches</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {visibleTypes.map(t => {
            const count = countByType[t] || 0;
            return (
              <Link
                key={t}
                to={`/t/${t}`}
                className="shrink-0 inline-flex items-center gap-1.5 bg-elev border border-border rounded-full px-3 py-1.5 text-xs font-medium hover:border-wood/50 transition"
              >
                <span className="text-ink">{typeLabel(t)}</span>
                <span className={count > 0 ? 'text-wood font-bold' : 'text-muted'}>{count}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {domains.map(d => (
          <Link
            key={d.id}
            to={`/d/${d.slug}`}
            className="group relative bg-elev border border-border rounded-xl aspect-square p-3 shadow-soft hover:border-wood/50 hover:-translate-y-0.5 transition flex flex-col"
          >
            <div className="text-wood">
              <DomainIcon name={d.icon} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1" />
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate">{d.name}</h2>
              <div className="text-xs text-muted mt-0.5 min-h-[1.1em]">
                {d.unread_count > 0 ? `${d.unread_count} new` : ''}
              </div>
            </div>
            {d.unread_count > 0 && (
              <span className="absolute top-2 right-2 text-[10px] font-bold text-bg bg-wood rounded-full px-1.5 py-0.5 min-w-[1.1rem] text-center">
                {d.unread_count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
