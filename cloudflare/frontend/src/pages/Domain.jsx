import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  // `postId` will be defined when the URL is /d/:slug/p/:postId — that's how
  // we make post detail a real route entry (so iOS swipe-back returns here
  // instead of going all the way to home).
  const { slug, postId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('unread');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Re-poll every 15s while tab is visible.
  usePoll(load, 15000, [slug, tab]);

  // Find the open post (when postId is in the URL). Fall back to fetching it
  // directly if it's not in the current tab's loaded list (e.g. user landed
  // directly on the URL).
  const [postDirect, setPostDirect] = useState(null);
  useEffect(() => {
    if (!postId) { setPostDirect(null); return; }
    const inList = posts.find(p => String(p.id) === String(postId));
    if (inList) { setPostDirect(null); return; }
    // Not in the current list — fetch directly so we still render it.
    api.getPost(postId).then(setPostDirect).catch(() => setPostDirect(null));
  }, [postId, posts]);
  const openPost = postId
    ? (posts.find(p => String(p.id) === String(postId)) || postDirect)
    : null;

  const onMarkRead = async (post) => {
    await api.patchPost(post.id, { is_read: true });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_read: true } : p));
  };
  const onToggleBookmark = async (post) => {
    const next = !post.is_bookmarked;
    await api.patchPost(post.id, { is_bookmarked: next });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_bookmarked: next } : p));
  };
  const onDismiss = async (post) => {
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try { await api.dismissPost(post.id); }
    catch (e) { console.warn('dismiss failed, reloading', e); load(); }
  };

  // ---- Post detail view (full-screen on every viewport) ----
  if (postId) {
    if (!openPost) return <div className="text-muted">Loading…</div>;
    return (
      <PostDetail
        post={openPost}
        onClose={() => navigate(`/d/${slug}`)}
        onMarkRead={() => { onMarkRead(openPost); }}
        onToggleBookmark={() => onToggleBookmark(openPost)}
      />
    );
  }

  // ---- Feed view ----
  const visiblePosts = tab === 'unread'
    ? posts.filter(p => !p.is_read && !p.is_dismissed)
    : tab === 'read'
    ? posts.filter(p => p.is_read && !p.is_dismissed)
    : posts.filter(p => p.is_bookmarked && !p.is_dismissed);

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
      ) : visiblePosts.length === 0 ? (
        <div className="text-muted text-center py-12">
          {tab === 'unread' ? 'You’re all caught up.' : tab === 'read' ? 'Nothing read yet.' : 'No bookmarks here yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={() => navigate(`/d/${slug}/p/${post.id}`)}
              onMarkRead={() => onMarkRead(post)}
              onToggleBookmark={() => onToggleBookmark(post)}
              onDismiss={() => onDismiss(post)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
