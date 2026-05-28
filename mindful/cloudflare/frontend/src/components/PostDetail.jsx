import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { BookmarkIcon, CheckIcon, HighlightIcon, ExternalIcon } from './Icons.jsx';

// Renders a post in a side-sheet, with text-selection → highlight.
export default function PostDetail({ post, onClose, onMarkRead, onToggleBookmark }) {
  const [highlights, setHighlights] = useState([]);
  const [selection, setSelection] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    api.listHighlights({ post_id: post.id }).then(setHighlights);
  }, [post.id]);

  // Listen for selection changes inside the body.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelection(''); return; }
      const text = sel.toString().trim();
      if (!text || !bodyRef.current) { setSelection(''); return; }
      // Make sure the selection is inside our body
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

  // Decorate the rendered body by wrapping existing highlight strings in <mark>.
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
    <div className="fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-elev border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-elev/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-2">
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
          >
            <BookmarkIcon filled={post.is_bookmarked} className="w-3.5 h-3.5" />
          </button>
          {post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-ink flex items-center gap-1.5">
              <ExternalIcon className="w-3.5 h-3.5" /> Open
            </a>
          )}
        </div>

        <div className="px-5 py-6">
          <div className="text-xs uppercase tracking-wider text-wood mb-2 font-bold">
            {post.source_name || post.author}
            {post.read_time_min ? ` · ${post.read_time_min} min` : ''}
          </div>
          {post.title && <h1 className="text-2xl font-bold leading-tight mb-3">{post.title}</h1>}
          {post.tldr && (
            <div className="bg-bg border-l-2 border-wood pl-3 py-1 mb-5 text-muted italic text-sm">
              TLDR · {post.tldr}
            </div>
          )}

          {post.video_url && (
            <div className="aspect-video mb-5 rounded-lg overflow-hidden border border-border bg-bg">
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
            <img src={post.image_url} alt="" className="rounded-lg mb-5 border border-border max-w-full" />
          )}

          <div
            ref={bodyRef}
            className="prose-mindful"
            dangerouslySetInnerHTML={renderBody()}
          />

          {highlights.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="font-bold text-sm uppercase tracking-wider text-wood mb-3">
                Your highlights ({highlights.length})
              </h3>
              <ul className="space-y-2">
                {highlights.map(h => (
                  <li key={h.id} className="text-sm text-muted bg-bg border-l-2 border-wood/60 pl-3 py-1.5">
                    “{h.text}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Floating highlight action when there's an active selection */}
        {selection && (
          <button
            onClick={saveHighlight}
            className="fixed bottom-6 right-6 z-20 bg-wood text-bg shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 hover:bg-wood-2 transition"
          >
            <HighlightIcon className="w-4 h-4" />
            <span className="text-sm font-bold">Highlight</span>
          </button>
        )}
      </div>
    </div>
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function escape(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
