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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {domains.map(d => (
        <Link
          key={d.id}
          to={`/d/${d.slug}`}
          className="group card relative bg-elev border border-border rounded-xl p-5 sm:p-6 shadow-soft hover:border-wood/50 hover:-translate-y-0.5 transition"
        >
          <div className="flex items-start gap-4">
            <div className="text-wood shrink-0">
              <DomainIcon name={d.icon} className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{d.name}</h2>
                {d.unread_count > 0 && (
                  <span className="shrink-0 text-xs font-bold text-bg bg-wood rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                    {d.unread_count}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted">
                {d.unread_count > 0
                  ? `${d.unread_count} new · ${d.total_count} total`
                  : d.total_count > 0
                  ? `${d.total_count} read`
                  : 'No content yet'}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
