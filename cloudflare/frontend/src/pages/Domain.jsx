import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { usePoll } from '../lib/poll.js';
import { useHeartbeat } from '../lib/realtime.js';
import { usePullToRefresh } from '../lib/pullToRefresh.js';
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

// Relative published-at bucket for the Unread feed's date grouping.
function dateBucket(iso) {
  if (!iso) return 'earlier';
  const then = new Date(iso);
  if (isNaN(then.getTime())) return 'earlier';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const days = Math.round((startToday - startThen) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return 'this week';
  return 'earlier';
}

const BUCKET_ORDER = ['today', 'yesterday', 'this week', 'earlier'];

export default function Domain() {
  const { slug, postId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('unread');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    const list = await api.listPosts({ domain: slug, filter: tab });
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    api.listDomains().then(ds => setDomain(ds.find(d => d.slug === slug)));
  }, [slug]);

  useEffect(() => { setLoading(true); setConfirmAll(false); setConfirmClear(false); load(); }, [slug, tab]);
  // Realtime: a 5s heartbeat scoped to this domain triggers one reload when new
  // content lands. A slow poll stays as a backstop (covers read/bookmark tabs
  // and any missed heartbeat). Both are visibility-gated.
  useHeartbeat({ domain: slug }, (hb, prevSig) => {
    const prevId = Number((prevSig || '0:0').split(':')[0]) || 0;
    load();
    if (hb.latest_id > prevId && !document.hidden) toast('new posts just landed.');
  }, 5000);
  usePoll(load, 60000, [slug, tab]);
  const pull = usePullToRefresh(load);

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
    toast(next ? 'saved for later.' : 'removed from saved.');
  };
  const onToggleWeekend = async (post) => {
    const next = !post.is_weekend;
    updateLocal(post.id, { is_weekend: next });
    await api.patchPost(post.id, { is_weekend: next });
    if (next) toast('saved for the weekend.');
  };
  const onDismiss = async (post) => {
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try { await api.dismissPost(post.id); }
    catch (e) { console.warn('dismiss failed, reloading', e); load(); }
  };

  const onClearDomain = async () => {
    const count = posts.filter(p => !p.is_dismissed).length;
    setPosts([]);
    setConfirmClear(false);
    try {
      const res = await api.clearDomain(domain.id);
      const n = res?.cleared ?? count;
      toast(`cleared ${n} ${n === 1 ? 'post' : 'posts'} from ${domainName}.`);
    } catch (e) {
      console.warn('clear domain failed, reloading', e);
      load();
    }
  };

  const onMarkAllRead = async () => {
    const targets = posts.filter(p => !p.is_read && !p.is_dismissed);
    const count = targets.length;
    setPosts(prev => prev.map(p => (!p.is_read && !p.is_dismissed) ? { ...p, is_read: true } : p));
    setConfirmAll(false);
    try {
      await api.markReadBulk(domain.id);
      toast(`marked ${count} posts as read.`);
    } catch (e) {
      console.warn('mark all failed, reloading', e);
      load();
    }
  };

  const domainName = domain?.name || slug;

  // ---- Post detail (full-screen route) ----
  if (postId) {
    if (!openPost) return <div className="text-muted">Loading…</div>;
    // Next unread in this domain, relative to the current post's position in
    // the loaded (unread-ordered) list.
    const ordered = posts.filter(p => !p.is_dismissed);
    const idx = ordered.findIndex(p => String(p.id) === String(postId));
    let nextPost = null;
    if (idx !== -1) {
      for (let i = idx + 1; i < ordered.length; i++) {
        if (!ordered[i].is_read) { nextPost = ordered[i]; break; }
      }
    }
    return (
      <PostDetail
        post={openPost}
        onClose={() => navigate(`/d/${slug}`)}
        onMarkRead={() => onMarkRead(openPost)}
        onToggleBookmark={() => onToggleBookmark(openPost)}
        onToggleWeekend={() => onToggleWeekend(openPost)}
        nextPost={nextPost}
        domainName={domainName}
        onOpenNext={(np) => navigate(`/d/${slug}/p/${np.id}`)}
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
    // Weekend-saved items auto-move out of Read into the Weekend tab.
    ? posts.filter(p => p.is_read && !p.is_weekend && !p.is_dismissed)
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
        <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Domains</Link>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none break-words">{domain?.name || slug}</h1>
      </div>

      <div className="flex items-stretch border-b-2 border-line mb-6">
        <div className="flex gap-0 overflow-x-auto flex-1 min-w-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-bold tt-label tracking-eyebrow border-b-2 -mb-0.5 transition-colors shrink-0 ${
                tab === t.key ? 'border-wood text-wood' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Clear domain — dismisses every post in this domain in one shot. */}
        {!loading && posts.length > 0 && (
          <div className="flex items-center pl-3 shrink-0">
            {confirmClear ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted hidden sm:inline">clear everything?</span>
                <button onClick={onClearDomain} className="text-wood font-bold hover:underline">yes</button>
                <button onClick={() => setConfirmClear(false)} className="text-muted hover:text-ink transition-colors">no</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                title="Remove all posts in this domain"
                className="text-xs font-bold tt-label tracking-eyebrow text-muted hover:text-wood transition-colors"
              >
                clear
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonList n={4} />
      ) : visiblePosts.length === 0 ? (
        <EmptyState kind={emptyKind} />
      ) : (
        <div>
          {/* Mark-all-read affordance — Unread tab only, 3+ unread. */}
          {tab === 'unread' && visiblePosts.length >= 3 && (
            <div className="mb-3">
              {confirmAll ? (
                <div className="flex items-center justify-end gap-3 text-xs text-muted flex-wrap">
                  <span>mark all {visiblePosts.length} unread posts in {domainName} as read?</span>
                  <button onClick={onMarkAllRead} className="text-wood font-bold hover:underline">yes, mark all</button>
                  <button onClick={() => setConfirmAll(false)} className="hover:text-ink transition-colors">cancel</button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => setConfirmAll(true)}
                    className="text-xs text-muted hover:text-ink transition-colors"
                  >
                    mark all as read
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'unread' ? (
            BUCKET_ORDER.map(bucket => {
              const group = visiblePosts.filter(
                p => dateBucket(p.published_at || p.ingested_at) === bucket
              );
              if (group.length === 0) return null;
              return (
                <div key={bucket}>
                  <h2 className="text-xs uppercase tracking-wider text-wood font-bold mt-6 mb-2">{bucket}</h2>
                  <div className="space-y-3">
                    {group.map(post => (
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
                </div>
              );
            })
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
      )}
    </div>
  );
}
