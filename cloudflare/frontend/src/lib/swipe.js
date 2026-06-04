// Tiny swipe-handler hook. No deps.
//
//   const swipe = useSwipeable({
//     onSwipeRight: () => markRead(),
//     onSwipeLeft:  () => dismiss(),
//     onLongPress:  () => toggleBookmark(),
//     onTap:        () => open(),
//   });
//   <article {...swipe.handlers} style={{ transform: swipe.transform }} />

import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 80;        // px past which we count as a swipe
const MOVEMENT_DEAD_ZONE = 10;     // px before we lock direction
const LONG_PRESS_MS = 480;

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch { /* no-op */ }
}

export function useSwipeable({ onSwipeRight, onSwipeLeft, onLongPress, onTap } = {}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const ref = useRef({
    startX: 0, startY: 0, locked: null, longTimer: null, moved: false, touchActive: false,
  });

  const reset = () => {
    setAnimating(true);
    setDx(0);
    setTimeout(() => setAnimating(false), 220);
  };

  const handlers = {
    onTouchStart: (e) => {
      const t = e.touches[0];
      ref.current = {
        startX: t.clientX, startY: t.clientY,
        locked: null, longTimer: null, moved: false, touchActive: true,
      };
      ref.current.longTimer = setTimeout(() => {
        if (!ref.current.moved && ref.current.touchActive) {
          vibrate(18);
          onLongPress?.();
          ref.current.longTimer = null;
          ref.current.touchActive = false;
        }
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      const ax = t.clientX - ref.current.startX;
      const ay = t.clientY - ref.current.startY;
      if (Math.abs(ax) > MOVEMENT_DEAD_ZONE || Math.abs(ay) > MOVEMENT_DEAD_ZONE) {
        ref.current.moved = true;
        if (ref.current.longTimer) {
          clearTimeout(ref.current.longTimer);
          ref.current.longTimer = null;
        }
      }
      if (ref.current.locked === null && ref.current.moved) {
        ref.current.locked = Math.abs(ax) > Math.abs(ay) ? 'x' : 'y';
      }
      if (ref.current.locked === 'x') {
        setDx(ax);
        // prevent the page from scrolling vertically while we swipe
        if (e.cancelable) e.preventDefault();
      }
    },
    onTouchEnd: (e) => {
      const finalDx = dx;
      const wasMoved = ref.current.moved;
      const wasLocked = ref.current.locked;
      if (ref.current.longTimer) clearTimeout(ref.current.longTimer);
      ref.current.touchActive = false;

      if (wasLocked === 'x' && Math.abs(finalDx) > SWIPE_THRESHOLD) {
        // Suppress the synthesized click so a horizontal swipe never also
        // triggers the card's onClick (open) handler.
        if (e?.cancelable) e.preventDefault();
        vibrate(12);
        // Animate card off-screen in direction of swipe
        setAnimating(true);
        setDx(finalDx > 0 ? 600 : -600);
        setTimeout(() => {
          if (finalDx > 0) onSwipeRight?.();
          else            onSwipeLeft?.();
          reset();
        }, 160);
        return;
      }
      // Tap (no significant movement, no long-press fired). We fire onTap here
      // and prevent the ghost click so the card's onClick (the desktop/mouse
      // open path) doesn't double-fire on touch devices.
      if (!wasMoved && onTap) {
        if (e?.cancelable) e.preventDefault();
        onTap();
      }
      reset();
    },
    onTouchCancel: () => {
      if (ref.current.longTimer) clearTimeout(ref.current.longTimer);
      ref.current.touchActive = false;
      reset();
    },
  };

  return {
    handlers,
    dx,
    transform: `translate3d(${dx}px, 0, 0)`,
    transition: animating ? 'transform 200ms cubic-bezier(.2,.8,.2,1)' : 'none',
  };
}
