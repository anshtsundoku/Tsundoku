import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { BookmarkIcon, CheckIcon, HighlightIcon, ExternalIcon, ShareIcon, WeekendIcon } from './Icons.jsx';

// Relative time for the "next up" sub-line. Mirrors PostCard's compact format.
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Pull image srcs out of an HTML string (used for X posts with media).
function extractImages(html) {
  if (!html) return [];
  const out = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

// Full-page post detail. Rendered when the route is /d/:slug/p/:postId.
// On mobile this fills the screen and the OS back gesture returns to the
// domain feed naturally. On desktop the article body is centered for
// comfortable reading width while header/footer span full viewport.
//
// nextPost / domainName / onOpenNext are optional: Domain.jsx supplies them to
// render the "next up" card; TypeFeed leaves them out so the card is omitted.
export default function PostDetail({
  post,
  onClose,
  onMarkRead,
  onToggleBookmark,
  onToggleWeekend,
  nextPost = null,
  domainName = null,
  onOpenNext,
}) {
  const [highlights, setHighlights] = useState([]);
  const [selection, setSelection] = useState('');
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef(null);
  const markedRef = useRef(false);

  const isTweet = (post.source_type || post.type) === 'twitter';

  useEffect(() => {
    api.listHighlights({ post_id: post.id }).then(setHighlights);
  }, [post.id]);

  // Reading progress: 0→100% as the article body scrolls through the viewport.
  useEffect(() => {
    const handle = () => {
      const el = bodyRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrolled = Math.max(0, -rect.top + viewport);
      setProgress(Math.min(100, (scrolled / rect.height) * 100));
    };
    document.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => document.removeEventListener('scroll', handle);
  }, [post.id]);

  // Auto mark-as-read once the reader passes 80%. Guarded to fire once per
  // post visit; reset when the post changes.
  useEffect(() => { markedRef.current = false; }, [post.id]);
  useEffect(() => {
    if (progress >= 80 && !post.is_read && !markedRef.current) {
      markedRef.current = true;
      onMarkRead?.();
    }
  }, [progress, post.is_read]);

  // Wire lazy-fade for images injected via dangerouslySetInnerHTML (prose body).
  // React onLoad can't attach to that markup, so we set it up imperatively.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.querySelectorAll('img').forEach(img => {
      img.loading = 'lazy';
      if (img.complete && img.naturalWidth > 0) {
        img.dataset.loaded = 'true';
      } else {
        img.dataset.loaded = 'false';
        img.addEventListener('load', () => { img.dataset.loaded = 'true'; }, { once: true });
        img.addEventListener('error', () => { img.dataset.loaded = 'true'; }, { once: true });
      }
    });
  }, [post.id, highlights, isTweet]);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelection(''); return; }
      const text = sel.toString().trim();
      if (!text || !bodyRef.current) { setSelection(''); return; }
      if (!bodyRef.current.contains(sel.anchorNode)) { setSelection(''); return; }
      setSelection(text);
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [post.id]);

  const saveHighlight = async () => {
    if (!selection) return;
    const h = await api.createHighlight({ post_id: post.id, text: selection });
    setHighlights(prev => [...prev, h]);
    window.getSelection()?.removeAllRanges();
    setSelection('');
  };

  const renderBody = () => {
    let html = post.content_html
      || (post.content_text ? `<p>${escape(post.content_text).replace(/\n\n+/g, '</p><p>')}</p>` : '');
    for (const h of highlights) {
      const re = new RegExp(escapeRegExp(h.text), 'g');
      html = html.replace(re, m => `<mark class="mindful-highlight">${m}</mark>`);
    }
    return { __html: html };
  };

  const tweetImgs = isTweet ? extractImages(post.content_html) : [];

  return (
    <div>
      {/* Reading progress bar — pinned to the very top, below the safe area. */}
      <div
        className="fixed left-0 bg-wood z-50 transition-all duration-100"
        style={{ top: 'env(safe-area-inset-top)', width: `${progress}%`, height: 2 }}
      />

      {/* Sticky local toolbar — Back / Mark read / Bookmark / Open external. */}
      <div className="flex items-center gap-2 pb-3 mb-6 border-b-2 border-line text-xs tt-label tracking-eyebrow font-bold flex-wrap">
        <button onClick={onClose} className="text-muted hover:text-ink transition-colors">← Back</button>
        <div className="flex-1" />
        {!post.is_read && (
          <button onClick={onMarkRead} className="px-2.5 py-1 border border-border text-muted hover:bg-ink hover:text-bg hover:border-ink transition-colors flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5" /> Mark read
          </button>
        )}
        <button
          onClick={onToggleBookmark}
          className={`px-2.5 py-1 border flex items-center gap-1.5 transition-colors ${
            post.is_bookmarked ? 'border-wood bg-wood text-bg' : 'border-border text-muted hover:bg-ink hover:text-bg hover:border-ink'
          }`}
          aria-label="Toggle bookmark"
        >
          <BookmarkIcon filled={post.is_bookmarked} className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleWeekend}
          className={`px-2.5 py-1 border flex items-center gap-1.5 transition-colors ${
            post.is_weekend ? 'border-wood bg-wood text-bg' : 'border-border text-muted hover:bg-ink hover:text-bg hover:border-ink'
          }`}
          aria-label="Save for the weekend"
          title="Save for the weekend"
        >
          <WeekendIcon filled={post.is_weekend} className="w-3.5 h-3.5" />
        </button>
        {post.url && (
          <button
            onClick={async () => {
              // navigator.share opens iOS's native sheet — "Copy Link"
              // there copies post.url (the source article), not the Tsundoku
              // route. Falls back to clipboard write on browsers without
              // share API.
              const payload = { title: post.title || 'Tsundoku', text: post.tldr || '', url: post.url };
              try {
                if (navigator.share && navigator.canShare?.(payload) !== false) {
                  await navigator.share(payload);
                  return;
                }
              } catch (e) {
                if (e.name === 'AbortError') return;
              }
              try {
                await navigator.clipboard.writeText(post.url);
                alert('link copied');
              } catch { /* swallow */ }
            }}
            className="px-2.5 py-1 border border-border text-muted hover:bg-ink hover:text-bg hover:border-ink transition-colors flex items-center gap-1.5"
            aria-label="Share"
          >
            <ShareIcon className="w-3.5 h-3.5" /> Share
          </button>
        )}
        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer" className="px-2.5 py-1 border border-border text-muted hover:bg-ink hover:text-bg hover:border-ink transition-colors flex items-center gap-1.5">
            <ExternalIcon className="w-3.5 h-3.5" /> Open original
          </a>
        )}
      </div>

      {/* Content column — comfortable reading width on desktop, full on mobile. */}
      <article className="max-w-3xl mx-auto">
        <div className="eyebrow text-wood mb-3">
          {post.source_name || post.author}
        </div>
        {post.title && <h1 className="text-3xl sm:text-4xl font-bold leading-[1.05] tracking-tight mb-5 break-words">{post.title}</h1>}
        {post.tldr ? (
          <div className="border-l-2 border-wood pl-4 py-1 mb-8 text-muted text-sm whitespace-pre-line">
            <span className="eyebrow text-wood not-italic mr-2">TLDR</span>
            {post.tldr}
          </div>
        ) : (
          <div className="text-muted text-xs mb-8">AI summary unavailable for this post.</div>
        )}

        {post.video_url && (
          <div className="aspect-video mb-8 overflow-hidden border border-border bg-bg">
            <iframe
              src={post.video_url}
              title={post.title || 'video'}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {post.image_url && !post.video_url && (
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            data-loaded="false"
            onLoad={(e) => { e.currentTarget.dataset.loaded = 'true'; }}
            className="mb-8 border border-border max-w-full"
          />
        )}

        {isTweet ? (
          /* X/Twitter post: quoted-tweet styling, optional media grid. */
          <div ref={bodyRef}>
            {post.author && (
              <div className="text-wood font-bold mb-3">@{post.author}</div>
            )}
            <div
              className="bg-elev border-l-2 border-wood pl-4 py-3 my-6 whitespace-pre-line break-words"
              style={{ fontSize: '1.5rem', lineHeight: 1.4, fontWeight: 400 }}
            >
              {post.content_text}
            </div>
            {tweetImgs.length > 1 && (
              <div className="grid grid-cols-2 gap-2 my-6">
                {tweetImgs.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    data-loaded="false"
                    onLoad={(e) => { e.currentTarget.dataset.loaded = 'true'; }}
                    className="rounded-lg w-full h-auto"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            ref={bodyRef}
            className="prose-mindful"
            dangerouslySetInnerHTML={renderBody()}
          />
        )}

        {highlights.length > 0 && (
          <div className="mt-12 pt-6 border-t-2 border-line">
            <h3 className="eyebrow text-wood mb-4">
              Your highlights ({highlights.length})
            </h3>
            <ul className="space-y-2">
              {highlights.map(h => (
                <li key={h.id} className="text-sm text-muted bg-elev border-l-2 border-wood pl-4 py-2">
                  “{h.text}”
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* "Next up" — next unread in this domain, or a finished-domain note.
            Omitted entirely when no domain context is supplied (e.g. TypeFeed). */}
        {(nextPost || domainName) && (
          <div className="mt-12 pt-6 border-t border-border">
            {nextPost ? (
              <button
                onClick={() => onOpenNext?.(nextPost)}
                className="block w-full text-left group"
              >
                <div className="text-xs text-muted uppercase tracking-wider mb-2">next up</div>
                <div className="text-lg font-bold mb-1 group-hover:text-wood transition-colors break-words">
                  {nextPost.title || nextPost.source_name || nextPost.author || 'untitled'}
                </div>
                <div className="text-muted text-sm">
                  {nextPost.source_name || nextPost.author}
                  {' · '}
                  {timeAgo(nextPost.published_at || nextPost.ingested_at)}
                </div>
              </button>
            ) : (
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">
                  you've read everything in {domainName}.
                </div>
                <Link to="/" className="text-wood underline">back to all domains →</Link>
              </div>
            )}
          </div>
        )}
      </article>

      {/* Floating highlight action when there's an active selection. */}
      {selection && (
        <button
          onClick={saveHighlight}
          className="fixed right-6 z-30 bg-wood text-bg px-4 py-2.5 flex items-center gap-2 hover:bg-wood-2 transition-colors tt-label tracking-eyebrow"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <HighlightIcon className="w-4 h-4" />
          <span className="text-sm font-bold">Highlight</span>
        </button>
      )}
    </div>
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function escape(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
