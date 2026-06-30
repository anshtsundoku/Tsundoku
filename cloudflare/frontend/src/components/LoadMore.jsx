import { useEffect, useRef } from 'react';

// Infinite-scroll sentinel. Renders an invisible target near the end of a feed
// and calls onLoadMore as it approaches the viewport (rootMargin prefetches a
// page ahead so the scroll never visibly stalls). Renders nothing once the feed
// is exhausted. The callback is kept in a ref so the observer survives
// re-renders without re-subscribing.
export default function LoadMore({ hasMore, loading, onLoadMore }) {
  const ref = useRef(null);
  const cb = useRef(onLoadMore);
  useEffect(() => { cb.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) cb.current?.(); },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex items-center justify-center py-8" aria-hidden="true">
      <span
        className={`inline-block w-5 h-5 rounded-full border-2 border-wood border-t-transparent ${
          loading ? 'animate-spin' : 'opacity-0'
        }`}
      />
    </div>
  );
}
