import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { usePoll } from '../lib/poll.js';
import { useHeartbeat } from '../lib/realtime.js';
import { usePullToRefresh } from '../lib/pullToRefresh.js';
import { typeLabel } from '../lib/labels.js';
import PostCard from '../components/PostCard.jsx';
import PostDetail from '../components/PostDetail.jsx';
import LoadMore from '../components/LoadMore.jsx';
import { SkeletonList } from '../components/Skeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const PAGE_SIZE = 30;

function cursorOf(list) {
  const last = list[list.length - 1];
  return last ? (last.published_at || last.ingested_at) : null;
}

// /t/:type → cross-domain feed filtered by a single source type.
// Reached from the "New Reads / Watches" pills on Home.
export default function TypeFeed() {
  const { type, postId } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingMore = useRef(false);

  const load = async () => {
    const list = await api.listPosts({ type, filter: 'unread', limit: PAGE_SIZE });
    setPosts(list);
    setCursor(cursorOf(list));
    setHasMore(list.length >= PAGE_SIZE);
    setLoading(false);
  };

  const refresh = async () => {
    const want = Math.min(Math.max(PAGE_SIZE, posts.length), 100);
    const list = await api.listPosts({ type, filter: 'unread', limit: want });
    setPosts(list);
    setCursor(cursorOf(list));
    setHasMore(list.length >= want);
    setLoading(false);
  };

  const loadMore = async () => {
    if (fetchingMore.current || !hasMore || !cursor) return;
    fetchingMore.current = true;
    setLoadingMore(true);
    try {
      const next = await api.listPosts({ type, filter: 'unread', cursor, limit: PAGE_SIZE });
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...next.filter(p => !seen.has(p.id))];
      });
      setCursor(cursorOf(next));
      setHasMore(next.length >= PAGE_SIZE);
    } catch (e) {
      console.warn('loadMore failed', e);
    } finally {
      setLoadingMore(false);
      fetchingMore.current = false;
    }
  };

  useEffect(() => { setLoading(true); load(); }, [type]);
  useHeartbeat({ type }, (hb, prevSig) => {
    const prevId = Number((prevSig || '0:0').split(':')[0]) || 0;
    refresh();
    if (hb.latest_id > prevId && !document.hidden) toast('new posts just landed.');
  }, 5000);
  usePoll(refresh, 60000, [type]);
  const pull = usePullToRefresh(refresh);

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
  const onMarkRead = async (p) => { updateLocal(p.id, { is_read: true }); await api.patchPost(p.id, { is_read: true }); };
  const onToggleBookmark = async (p) => { const n = !p.is_bookmarked; updateLocal(p.id, { is_bookmarked: n }); await api.patchPost(p.id, { is_bookmarked: n }); toast(n ? 'saved for later.' : 'removed from saved.'); };
  const onToggleWeekend  = async (p) => { const n = !p.is_weekend; updateLocal(p.id, { is_weekend: n }); await api.patchPost(p.id, { is_weekend: n }); if (n) toast('saved for the weekend.'); };
  const onDismiss = async (p) => { setPosts(prev => prev.filter(x => x.id !== p.id)); try { await api.dismissPost(p.id); } catch { load(); } };

  if (postId) {
    if (!openPost) return <div className="text-muted">Loading…</div>;
    return (
      <PostDetail
        post={openPost}
        onClose={() => navigate(`/t/${type}`)}
        onMarkRead={() => onMarkRead(openPost)}
        onToggleBookmark={() => onToggleBookmark(openPost)}
        onToggleWeekend={() => onToggleWeekend(openPost)}
      />
    );
  }

  const visible = posts.filter(p => !p.is_read && !p.is_dismissed);

  return (
    <div {...pull.handlers}>
      {(pull.isRefreshing || pull.pullDistance > 0) && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: pull.isRefreshing ? 36 : pull.pullDistance }}
        >
          <span
            className="inline-block w-5 h-5 rounded-full border-2 border-wood border-t-transparent animate-spin"
            style={{ opacity: pull.isRefreshing ? 1 : Math.min(1, pull.pullDistance / 80) }}
          />
        </div>
      )}

      <div className="mb-6">
        <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Home</Link>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none break-words">{typeLabel(type)} / New</h1>
      </div>

      {loading ? (
        <SkeletonList n={4} />
      ) : visible.length === 0 ? (
        <EmptyState kind="caught-up" />
      ) : (
        <div>
          <div className="space-y-3">
            {visible.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={() => navigate(`/t/${type}/p/${post.id}`)}
                onMarkRead={() => onMarkRead(post)}
                onToggleBookmark={() => onToggleBookmark(post)}
                onToggleWeekend={() => onToggleWeekend(post)}
                onDismiss={() => onDismiss(post)}
              />
            ))}
          </div>
          <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}
