// Realtime freshness via a 1-second heartbeat.
//
// Instead of refetching a full post list every second (expensive, and rough on
// the worker's free-tier request budget), we poll a tiny `/posts/heartbeat`
// endpoint that returns just { unread, latest_id, latest_at }. When the
// signature changes, we fire onChange — the page then does ONE real reload.
//
// Guards: only ticks while the tab is visible, never overlaps in-flight
// requests, and swallows transient errors silently.
import { useEffect, useRef } from 'react';
import { api } from './api.js';

export function useHeartbeat(scope, onChange, intervalMs = 1000) {
  const savedOnChange = useRef(onChange);
  useEffect(() => { savedOnChange.current = onChange; }, [onChange]);

  const scopeKey = JSON.stringify(scope || {});

  useEffect(() => {
    let timer = null;
    let stopped = false;
    let inFlight = false;
    let last = null; // last seen signature string

    const tick = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const hb = await api.heartbeat(scope || {});
        const sig = `${hb.latest_id}:${hb.unread}`;
        if (last !== null && sig !== last) {
          savedOnChange.current?.(hb, last);
        }
        last = sig;
      } catch {
        // transient — try again next tick
      } finally {
        inFlight = false;
      }
    };

    const start = () => { if (!timer) timer = setInterval(tick, intervalMs); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const onVis = () => { if (document.hidden) stop(); else { start(); tick(); } };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, intervalMs]);
}
