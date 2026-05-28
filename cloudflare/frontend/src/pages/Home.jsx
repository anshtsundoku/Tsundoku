import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { DomainIcon } from '../components/Icons.jsx';

export default function Home() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const ds = await api.listDomains();
      setDomains(ds || []);
      setError(null);
    } catch (e) {
      console.error('Home: failed to load domains', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  usePoll(load, 15000, []);

  if (loading) return <div className="text-muted">Loading…</div>;
  if (error)   return <div className="text-wood text-sm">Couldn’t load domains: {error}</div>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            {/* v1.2 spec: show only "X new" if there's something new. Empty in every
                other case (no total, no "X read"). */}
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
  );
}
