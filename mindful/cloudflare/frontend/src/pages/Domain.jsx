import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import PostCard from '../components/PostCard.jsx';
import PostDetail from '../components/PostDetail.jsx';

const TABS = [
  { key: 'unread',   label: 'Unread' },
  { key: 'read',     label: 'Read' },
  { key: 'bookmark', label: 'Bookmarked' },
];

export default function Domain() {
  const { slug } = useParams();
  const [tab, setTab] = useState('unread');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [domain, setDomain] = useState(null);

  const load = async () => {
    const list = await api.listPosts(slug, tab);
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    api.listDomains().then(ds => setDomain(ds.find(d => d.slug === slug)));
  }, [slug]);

  useEffect(() => { setLoading(true); load(); }, [slug, tab]);

  // Replace WebSocket subscription with a 30s poll. The tab is invisible →
  // poller pauses, so we don't waste CPU/network when not in use.
  usePoll(load, 30000, [slug, tab]);

  const onMarkRead = async (post) => {
    await api.patchPost(post.id, { is_read: true });
    setPosts(prev => prev.filter(p => p.id !== post.id || tab !== 'unread'));
  };
  const onToggleBookmark = async (post) => {
    const next = !post.is_bookmarked;
    await api.patchPost(post.id, { is_bookmarked: next });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_bookmarked: next } : p)
                          .filter(p => tab !== 'bookmark' || p.is_bookmarked));
  };
  const onDismiss = async (post) => {
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try { await api.dismissPost(post.id); }
    catch (e) { console.warn('dismiss failed, reloading', e); load(); }
  };

  const openPost = useMemo(() => posts.find(p => p.id === open) || null, [open, posts]);

  return (
    <div>
      <div className="mb-5">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Domains</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{domain?.name || slug}</h1>
      </div>

      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.key ? 'border-wood text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-muted text-center py-12">
          {tab === 'unread' ? 'You’re all caught up.' : tab === 'read' ? 'Nothing read yet.' : 'No bookmarks here yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={() => setOpen(post.id)}
              onMarkRead={() => onMarkRead(post)}
              onToggleBookmark={() => onToggleBookmark(post)}
              onDismiss={() => onDismiss(post)}
            />
          ))}
        </div>
      )}

      {openPost && (
        <PostDetail
          post={openPost}
          onClose={() => setOpen(null)}
          onMarkRead={() => { onMarkRead(openPost); setOpen(null); }}
          onToggleBookmark={() => onToggleBookmark(openPost)}
        />
      )}
    </div>
  );
}
