// Tiny "every N ms re-fetch when the tab is visible" hook. Drop-in
// replacement for the WebSocket-driven realtime in the Docker version.
import { useEffect, useRef } from 'react';

export function usePoll(fn, intervalMs = 30000, deps = []) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);

  useEffect(() => {
    let timer = null;
    let stopped = false;
    const tick = () => { if (!stopped && !document.hidden) saved.current?.(); };

    const start = () => {
      tick();
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const onVis = () => {
      if (document.hidden) stop();
      else if (!timer) start();
    };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
