import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import PostCard from '../components/PostCard.jsx';
import PostDetail from '../components/PostDetail.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const TABS = [
  { key: 'unread',   label: 'Unread' },
  { key: 'read',     label: 'Read' },
  { key: 'bookmark', label: 'Bookmarked' },
  { key: 'weekend',  label: 'Weekend' },
];

export default function Domain() {
  const { slug, postId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('unread');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState(null);

  const load = async () => {
    const list = await api.listPosts({ domain: slug, filter: tab });
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    api.listDomains().then(ds => setDomain(ds.find(d => d.slug === slug)));
  }, [slug]);

  useEffect(() => { setLoading(true); load(); }, [slug, tab]);
  usePoll(load, 15000, [slug, tab]);

  // Direct fetch fallback when arriving at /d/:slug/p/:postId fresh.
  const [postDirect, setPostDirect] = useState(null);
  useEffect(() => {
    if (!postId) { setPostDirect(null); return; }
    const inList = posts.find(p => String(p.id) === String(postId));
    if (inList) { setPostDirect(null); return; }
    api.getPost(postId).then(setPostDirect).catch(() => setPostDirect(null));
  }, [postId, posts]);
  const openPost = postId
    ? (posts.find(p => String(p.id) === String(postId)) || postDirect)
    : null;

  const updateLocal = (id, patch) =>
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));

  const onMarkRead = async (post) => {
    updateLocal(post.id, { is_read: true });
    await api.patchPost(post.id, { is_read: true });
  };
  const onToggleBookmark = async (post) => {
    const next = !post.is_bookmarked;
    updateLocal(post.id, { is_bookmarked: next });
    await api.patchPost(post.id, { is_bookmarked: next });
  };
  const onToggleWeekend = async (post) => {
    const next = !post.is_weekend;
    updateLocal(post.id, { is_weekend: next });
    await api.patchPost(post.id, { is_weekend: next });
  };
  const onDismiss = async (post) => {
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try { await api.dismissPost(post.id); }
    catch (e) { console.warn('dismiss failed, reloading', e); load(); }
  };

  // ---- Post detail (full-screen route) ----
  if (postId) {
    if (!openPost) return <div className="text-muted">Loading…</div>;
    return (
      <PostDetail
        post={openPost}
        onClose={() => navigate(`/d/${slug}`)}
        onMarkRead={() => onMarkRead(openPost)}
        onToggleBookmark={() => onToggleBookmark(openPost)}
        onToggleWeekend={() => onToggleWeekend(openPost)}
      />
    );
  }

  // ---- Feed ----
  // Server already filters by `filter`, but as posts get mutated locally
  // (mark read, toggle bookmark, etc.) we hide things that fell out of the
  // current tab criteria.
  const visiblePosts = tab === 'unread'
    ? posts.filter(p => !p.is_read && !p.is_dismissed)
    : tab === 'read'
    ? posts.filter(p => p.is_read && !p.is_dismissed)
    : tab === 'bookmark'
    ? posts.filter(p => p.is_bookmarked && !p.is_dismissed)
    : posts.filter(p => p.is_weekend && !p.is_dismissed);

  const emptyKind = {
    unread:   'caught-up',
    read:     'nothing-read',
    bookmark: 'no-bookmarks',
    weekend:  'no-weekend',
  }[tab];

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Domains</Link>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight uppercase leading-none">{domain?.name || slug}</h1>
      </div>

      <div className="flex gap-0 border-b-2 border-ink mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-eyebrow border-b-2 -mb-0.5 transition-colors shrink-0 ${
              tab === t.key ? 'border-wood text-wood' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList n={4} />
      ) : visiblePosts.length === 0 ? (
        <EmptyState kind={emptyKind} />
      ) : (
        <div className="space-y-3">
          {visiblePosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={() => navigate(`/d/${slug}/p/${post.id}`)}
              onMarkRead={() => onMarkRead(post)}
              onToggleBookmark={() => onToggleBookmark(post)}
              onToggleWeekend={() => onToggleWeekend(post)}
              onDismiss={() => onDismiss(post)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
