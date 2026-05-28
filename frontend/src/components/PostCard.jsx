import { BookmarkIcon, CheckIcon, XIcon } from './Icons.jsx';

function sourceBadge(type) {
  return { rss: 'RSS', website: 'Web', twitter: '𝕏', youtube: 'YT', newsletter: '✉' }[type] || type;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PostCard({ post, onOpen, onMarkRead, onToggleBookmark, onDismiss }) {
  return (
    <article
      className="card group bg-elev border border-border rounded-xl p-4 shadow-soft hover:border-wood/40 cursor-pointer transition"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2 text-xs text-muted mb-2">
        <span className="font-bold uppercase tracking-wider text-wood">
          {sourceBadge(post.source_type)}
        </span>
        <span>·</span>
        <span className="truncate">{post.source_name || post.author}</span>
        <span>·</span>
        <span>{timeAgo(post.published_at || post.ingested_at)}</span>
        <span>·</span>
        <span>{post.read_time_min ? `${post.read_time_min} min` : ''}</span>
      </div>

      {post.title && (
        <h3 className="font-bold text-lg leading-snug mb-1.5 group-hover:text-wood transition">{post.title}</h3>
      )}

      {post.tldr && (
        <p className="text-sm text-muted leading-relaxed mb-3">{post.tldr}</p>
      )}

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="rounded-md mb-3 w-full max-h-56 object-cover border border-border"
        />
      )}

      <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
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
  );
}
