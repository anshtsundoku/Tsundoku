import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { BookmarkIcon, CheckIcon, HighlightIcon, ExternalIcon, WeekendIcon } from './Icons.jsx';

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
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
        <button onClick={onClose} className="text-sm text-muted hover:text-ink">← Back</button>
        <div className="flex-1" />
        {!post.is_read && (
          <button onClick={onMarkRead} className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-ink flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5" /> Mark read
          </button>
        )}
        <button
          onClick={onToggleBookmark}
          className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
            post.is_bookmarked ? 'border-wood text-wood bg-wood/10' : 'border-border text-muted hover:text-ink'
          }`}
          aria-label="Toggle bookmark"
        >
          <BookmarkIcon filled={post.is_bookmarked} className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleWeekend}
          className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
            post.is_weekend ? 'border-wood text-wood bg-wood/10' : 'border-border text-muted hover:text-ink'
          }`}
          aria-label="Save for the weekend"
          title="Save for the weekend"
        >
          <WeekendIcon filled={post.is_weekend} className="w-3.5 h-3.5" />
        </button>
        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-ink flex items-center gap-1.5">
            <ExternalIcon className="w-3.5 h-3.5" /> Open
          </a>
        )}
      </div>

      {/* Content column — comfortable reading width on desktop, full on mobile. */}
      <article className="max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-wood mb-2 font-bold">
          {post.source_name || post.author}
          {post.read_time_min ? ` · ${post.read_time_min} min` : ''}
        </div>
        {post.title && <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-4">{post.title}</h1>}
        {post.tldr && (
          <div className="bg-elev border-l-2 border-wood pl-3 py-2 mb-6 text-muted italic text-sm whitespace-pre-line">
            <span className="text-wood font-bold not-italic mr-1">TLDR</span>
            {post.tldr}
          </div>
        )}

        {post.video_url && (
          <div className="aspect-video mb-6 rounded-lg overflow-hidden border border-border bg-bg">
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
          <img src={post.image_url} alt="" className="rounded-lg mb-6 border border-border max-w-full" />
        )}

        <div
          ref={bodyRef}
          className="prose-mindful"
          dangerouslySetInnerHTML={renderBody()}
        />

        {highlights.length > 0 && (
          <div className="mt-10 pt-6 border-t border-border">
            <h3 className="font-bold text-sm uppercase tracking-wider text-wood mb-3">
              Your highlights ({highlights.length})
            </h3>
            <ul className="space-y-2">
              {highlights.map(h => (
                <li key={h.id} className="text-sm text-muted bg-elev border-l-2 border-wood/60 pl-3 py-1.5">
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
          className="fixed right-6 z-30 bg-wood text-bg shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 hover:bg-wood-2 transition"
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
