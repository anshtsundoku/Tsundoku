import { BookmarkIcon, CheckIcon, XIcon, WeekendIcon } from './Icons.jsx';
import { typeLabel } from '../lib/labels.js';
import { useSwipeable } from '../lib/swipe.js';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PostCard({ post, onOpen, onMarkRead, onToggleBookmark, onToggleWeekend, onDismiss }) {
  const isYouTube = post.source_type === 'youtube' && post.video_url;

  // Touch gestures: right swipe = mark read, left swipe = dismiss,
  // long-press = bookmark, tap = open. Buttons still work on desktop.
  const swipe = useSwipeable({
    onSwipeRight: () => onMarkRead?.(),
    onSwipeLeft:  () => onDismiss?.(),
    onLongPress:  () => onToggleBookmark?.(),
    onTap:        () => onOpen?.(),
  });

  const dx = swipe.dx;
  const hintOpacity = Math.min(1, Math.abs(dx) / 80);

  return (
    <div className="relative">
      {/* Swipe-action hints rendered behind the card. */}
      {dx > 10 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center pl-5 text-wood pointer-events-none"
          style={{ opacity: hintOpacity }}
        >
          <CheckIcon className="w-5 h-5" />
          <span className="text-sm font-bold ml-1.5">read</span>
        </div>
      )}
      {dx < -10 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center pr-5 text-wood pointer-events-none"
          style={{ opacity: hintOpacity }}
        >
          <span className="text-sm font-bold mr-1.5">remove</span>
          <XIcon className="w-5 h-5" />
        </div>
      )}

      <article
        {...swipe.handlers}
        style={{ transform: swipe.transform, transition: swipe.transition, touchAction: 'pan-y' }}
        className="card group bg-elev border border-border rounded-xl p-4 shadow-soft hover:border-wood/40 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-xs text-muted mb-2">
          <span className="font-bold uppercase tracking-wider text-wood">
            {typeLabel(post.source_type)}
          </span>
          <span>·</span>
          <span className="truncate">{post.source_name || post.author}</span>
          <span>·</span>
          <span>{timeAgo(post.published_at || post.ingested_at)}</span>
          {post.read_time_min ? <><span>·</span><span>{post.read_time_min} min</span></> : null}
        </div>

        {post.title && (
          <h3 className="font-bold text-lg leading-snug mb-1.5 group-hover:text-wood transition">{post.title}</h3>
        )}

        {post.tldr ? (
          <p className="text-sm text-muted leading-relaxed mb-3 whitespace-pre-line">{post.tldr}</p>
        ) : null}

        {isYouTube ? (
          <div
            className="aspect-video mb-3 rounded-md overflow-hidden border border-border bg-bg"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <iframe
              src={post.video_url}
              title={post.title || 'video'}
              className="w-full h-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : post.image_url ? (
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            className="rounded-md mb-3 w-full max-h-56 object-cover border border-border"
          />
        ) : null}

        <div
          className="flex items-center gap-2 mt-1 flex-wrap"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {!post.is_read && (
            <button
              onClick={onMarkRead}
              className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-ink hover:border-wood/50 flex items-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" /> Mark read
            </button>
          )}
          <button
            onClick={onToggleBookmark}
            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              post.is_bookmarked
                ? 'border-wood text-wood bg-wood/10'
                : 'border-border text-muted hover:text-ink hover:border-wood/50'
            }`}
          >
            <BookmarkIcon filled={post.is_bookmarked} className="w-3.5 h-3.5" />
            {post.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button
            onClick={onToggleWeekend}
            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              post.is_weekend
                ? 'border-wood text-wood bg-wood/10'
                : 'border-border text-muted hover:text-ink hover:border-wood/50'
            }`}
            title="Save for the weekend"
          >
            <WeekendIcon filled={post.is_weekend} className="w-3.5 h-3.5" />
            Weekend
          </button>
          <div className="flex-1" />
          <button
            onClick={onDismiss}
            aria-label="Remove from feed"
            title="Remove from feed"
            className="text-xs px-2 py-1 rounded-md text-muted hover:text-wood hover:bg-wood/5 flex items-center gap-1.5"
          >
            <XIcon className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      </article>
    </div>
  );
}
