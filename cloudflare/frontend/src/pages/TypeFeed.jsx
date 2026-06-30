import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { usePoll } from '../lib/poll.js';
import { useHeartbeat } from '../lib/realtime.js';
import { typeLabel } from '../lib/labels.js';
import PostCard from '../components/PostCard.jsx';
import PostDetail from '../components/PostDetail.jsx';

// /t/:type → cross-domain feed filtered by a single source type.
// Reached from the "New Reads / Watches" pills on Home.
export default function TypeFeed() {
  const { type, postId } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const list = await api.listPosts({ type, filter: 'unread' });
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [type]);
  useHeartbeat({ type }, (hb, prevSig) => {
    const prevId = Number((prevSig || '0:0').split(':')[0]) || 0;
    load();
    if (hb.latest_id > prevId && !document.hidden) toast('new posts just landed.');
  }, 5000);
  usePoll(load, 60000, [type]);

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
    <div>
      <div className="mb-6">
        <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Home</Link>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none break-words">{typeLabel(type)} / New</h1>
      </div>

      {loading ? (
        <div className="eyebrow text-muted">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="eyebrow text-muted text-center py-12">No new {typeLabel(type).toLowerCase()} items right now.</div>
      ) : (
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
      )}
    </div>
  );
}
