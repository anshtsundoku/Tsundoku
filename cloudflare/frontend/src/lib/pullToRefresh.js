// Pull-to-refresh hook for touch devices. No deps.
//
//   const ptr = usePullToRefresh(load);
//   <div {...ptr.handlers}>
//     {(ptr.isRefreshing || ptr.pullDistance > 0) && <spinner />}
//     ...feed...
//   </div>
//
// Only engages on coarse pointers (touchscreens). On any other pointer it
// returns no-op handlers so desktop scroll/select is untouched.

import { useCallback, useRef, useState } from 'react';

const THRESHOLD = 80;     // px of pull (after resistance) that triggers refresh
const MAX_PULL = 120;     // px the indicator can travel
const RESISTANCE = 0.5;   // finger travel → indicator travel ratio

function isCoarsePointer() {
  try { return window.matchMedia('(pointer: coarse)').matches; }
  catch { return false; }
}

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ref = useRef({ startY: 0, active: false, pulling: false });

  const finish = useCallback(async () => {
    setPullDistance(0);
    setIsRefreshing(true);
    try { await onRefresh?.(); }
    finally { setIsRefreshing(false); }
  }, [onRefresh]);

  // Desktop / fine pointers: opt out entirely.
  if (!isCoarsePointer()) {
    return { handlers: {}, isRefreshing: false, pullDistance: 0 };
  }

  const handlers = {
    onTouchStart: (e) => {
      // Only engage when the page is scrolled to the very top.
      if (isRefreshing || window.scrollY > 0) { ref.current.active = false; return; }
      ref.current = { startY: e.touches[0].clientY, active: true, pulling: false };
    },
    onTouchMove: (e) => {
      if (!ref.current.active) return;
      const dy = e.touches[0].clientY - ref.current.startY;
      if (dy <= 0) { setPullDistance(0); ref.current.pulling = false; return; }
      const dist = Math.min(MAX_PULL, dy * RESISTANCE);
      ref.current.pulling = dist > 4;
      // Suppress the native overscroll/scroll while actively pulling.
      if (ref.current.pulling && e.cancelable) e.preventDefault();
      setPullDistance(dist);
    },
    onTouchEnd: () => {
      if (!ref.current.active) return;
      const reached = pullDistance >= THRESHOLD;
      ref.current.active = false;
      ref.current.pulling = false;
      if (reached) finish();
      else setPullDistance(0);
    },
    onTouchCancel: () => {
      ref.current.active = false;
      ref.current.pulling = false;
      setPullDistance(0);
    },
  };

  return { handlers, isRefreshing, pullDistance };
}
