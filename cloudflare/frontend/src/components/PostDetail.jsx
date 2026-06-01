import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { BookmarkIcon, CheckIcon, HighlightIcon, ExternalIcon, ShareIcon, WeekendIcon } from './Icons.jsx';

// Full-page post detail. Rendered when the route is /d/:slug/p/:postId.
// On mobile this fills the screen and the OS back gesture returns to the
// domain feed naturally. On desktop the article body is centered for
// comfortable reading width while header/footer span full viewport.
export default function PostDetail({ post, onClose, onMarkRead, onToggleBookmark, onToggleWeekend }) {
  const [highlights, setHighlights] = useState([]);
  const [selection, setSelection] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    api.listHighlights({ post_id: post.id }).then(setHighlights);
  }, [post.id]);

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

  return (
    <div>
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
            <ExternalIcon className="w-3.5 h-3.5" /> Open
          </a>
        )}
      </div>

      {/* Content column — comfortable reading width on desktop, full on mobile. */}
      <article className="max-w-3xl mx-auto">
        <div className="eyebrow text-wood mb-3">
          {post.source_name || post.author}
          {post.read_time_min ? ` / ${post.read_time_min} min` : ''}
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
          <img src={post.image_url} alt="" className="mb-8 border border-border max-w-full" />
        )}

        <div
          ref={bodyRef}
          className="prose-mindful"
          dangerouslySetInnerHTML={renderBody()}
        />

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
