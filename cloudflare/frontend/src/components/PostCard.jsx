import { useState } from 'react';
import { Mail, Play } from 'lucide-react';
import { BookmarkIcon, CheckIcon, XIcon, WeekendIcon } from './Icons.jsx';
import { typeLabel } from '../lib/labels.js';
import { useSwipeable } from '../lib/swipe.js';

// Gmail sources read as "Email" in the feed (with a Mail glyph). Other types
// fall through to the shared typeLabel map.
function sourceLabel(type) {
  return type === 'gmail' ? 'Email' : typeLabel(type);
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Tweet feed text: show the actual tweet content, trimmed to a 200-char
// preview (drop any trailing t.co media link first) instead of relying on a
// summary or just showing the image.
const TWEET_PREVIEW_LIMIT = 200;
function tweetPreview(text) {
  if (!text) return '';
  const cleaned = text.replace(/\s*https:\/\/t\.co\/\S+\s*$/g, '').trim();
  if (cleaned.length <= TWEET_PREVIEW_LIMIT) return cleaned;
  return cleaned.slice(0, TWEET_PREVIEW_LIMIT).trimEnd() + '…';
}

export default function PostCard({ post, onOpen, onMarkRead, onToggleBookmark, onToggleWeekend, onDismiss }) {
  const isYouTube = post.source_type === 'youtube' && post.video_url;
  const isTweet = post.source_type === 'twitter';
  const tweetText = isTweet ? tweetPreview(post.content_text) : '';
  // YouTube cards stay light: show a thumbnail with a play button and only
  // mount the (heavy) iframe once the user actually taps play.
  const [playing, setPlaying] = useState(false);
  const ytThumb = post.image_url || null;

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
          <span className="text-xs font-bold tt-label tracking-eyebrow ml-1.5">read</span>
        </div>
      )}
      {dx < -10 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center pr-5 text-wood pointer-events-none"
          style={{ opacity: hintOpacity }}
        >
          <span className="text-xs font-bold tt-label tracking-eyebrow mr-1.5">remove</span>
          <XIcon className="w-5 h-5" />
        </div>
      )}

      <article
        {...swipe.handlers}
        onClick={() => onOpen?.()}
        style={{ transform: swipe.transform, transition: swipe.transition, touchAction: 'pan-y' }}
        className="card group bg-elev border border-border p-4 hover:border-ink transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-xs text-muted mb-2.5 tt-label tracking-eyebrow min-w-0">
          <span className="font-bold text-wood shrink-0 inline-flex items-center gap-1">
            {post.source_type === 'gmail' && <Mail className="w-3 h-3" />}
            {sourceLabel(post.source_type)}
          </span>
          <span className="sep shrink-0" />
          <span className="truncate font-medium text-ink">{post.source_name || post.author}</span>
          <span className="sep shrink-0" />
          <span className="tabular-nums shrink-0">{timeAgo(post.published_at || post.ingested_at)}</span>
        </div>

        {post.title && (
          <h3 className="font-bold text-lg leading-snug tracking-tight mb-1.5 group-hover:text-wood transition-colors break-words">{post.title}</h3>
        )}

        {/* Tweets: show the tweet text (200-char preview) as the primary body
            rather than only an image. Other types keep the AI TLDR. */}
        {isTweet ? (
          tweetText ? (
            <p className="text-[15px] text-ink leading-relaxed mb-3 whitespace-pre-line break-words">{tweetText}</p>
          ) : null
        ) : post.tldr ? (
          <p className="text-sm text-muted leading-relaxed mb-3 whitespace-pre-line">{post.tldr}</p>
        ) : null}

        {isYouTube ? (
          playing ? (
            <div
              className="aspect-video mb-3 overflow-hidden border border-border bg-bg"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <iframe
                src={`${post.video_url}?autoplay=1`}
                title={post.title || 'video'}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              type="button"
              aria-label="Play video"
              onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
              onTouchStart={(e) => e.stopPropagation()}
              className="relative block w-full aspect-video mb-3 overflow-hidden border border-border bg-bg group/play"
            >
              {ytThumb && (
                <img
                  src={ytThumb}
                  alt=""
                  loading="lazy"
                  data-loaded="false"
                  onLoad={(e) => { e.currentTarget.dataset.loaded = 'true'; }}
                  className="w-full h-full object-cover"
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm group-hover/play:bg-wood transition-colors">
                  <Play className="w-6 h-6 text-white translate-x-0.5" fill="currentColor" />
                </span>
              </span>
            </button>
          )
        ) : post.image_url ? (
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            data-loaded="false"
            onLoad={(e) => { e.currentTarget.dataset.loaded = 'true'; }}
            className="mb-3 w-full max-h-56 object-cover border border-border"
          />
        ) : null}

        <div
          className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap text-xs tt-label tracking-eyebrow font-bold"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {!post.is_read && (
            <button
              onClick={onMarkRead}
              className="px-2.5 py-1 border border-border text-muted hover:bg-ink hover:text-bg hover:border-ink transition-colors flex items-center gap-1.5"
            >
              <CheckIcon className="w-3.5 h-3.5" /> Mark read
            </button>
          )}
          <button
            onClick={onToggleBookmark}
            className={`px-2.5 py-1 border flex items-center gap-1.5 transition-colors ${
              post.is_bookmarked
                ? 'border-wood bg-wood text-bg'
                : 'border-border text-muted hover:bg-ink hover:text-bg hover:border-ink'
            }`}
          >
            <BookmarkIcon filled={post.is_bookmarked} className="w-3.5 h-3.5" />
            {post.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button
            onClick={onToggleWeekend}
            className={`px-2.5 py-1 border flex items-center gap-1.5 transition-colors ${
              post.is_weekend
                ? 'border-wood bg-wood text-bg'
                : 'border-border text-muted hover:bg-ink hover:text-bg hover:border-ink'
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
            className="px-2 py-1 text-muted hover:text-wood transition-colors flex items-center gap-1.5"
          >
            <XIcon className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      </article>
    </div>
  );
}
