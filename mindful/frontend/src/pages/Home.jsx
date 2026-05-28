import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { DomainIcon } from '../components/Icons.jsx';

export default function Home() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.listDomains().then(setDomains).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const onTick = () => load();
    socket.on('feed:tick', onTick);
    return () => socket.off('feed:tick', onTick);
  }, []);

  return (
    <div>
      <p className="text-muted mb-6 font-light">
        Four corners of attention. Pick one.
      </p>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {domains.map(d => (
            <Link
              key={d.id}
              to={`/d/${d.slug}`}
              className="group card relative bg-elev border border-border rounded-xl p-5 shadow-soft hover:border-wood/50 hover:-translate-y-0.5 transition"
            >
              <div className="flex items-start gap-4">
                <div className="text-wood">
                  <DomainIcon name={d.icon} className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-xl font-bold tracking-tight">{d.name}</h2>
                    {d.unread_count > 0 && (
                      <span className="text-xs font-bold text-bg bg-wood rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
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
      )}

      <div className="mt-10 text-center">
        <Link to="/sources" className="text-sm text-muted hover:text-ink underline-offset-2 hover:underline">
          Manage sources →
        </Link>
      </div>
    </div>
  );
}
