import { useEffect, useRef, useState } from 'react';

// Bottom-center pill that surfaces when a new service worker is ready. Tapping
// applies the waiting SW (window.__tsundokuUpdate) which reloads the page.
//
// Auto-dismisses after 30s; reappears on the next visibility change while an
// update is still pending (main.jsx re-checks for updates on resume).
export default function UpdateToast() {
  const [show, setShow] = useState(false);
  const pending = useRef(false);  // an update was announced and not yet applied

  useEffect(() => {
    const onUpdate = () => { pending.current = true; setShow(true); };
    window.addEventListener('tsundoku:update-available', onUpdate);

    const onVisible = () => {
      if (document.visibilityState === 'visible' && pending.current) setShow(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('tsundoku:update-available', onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 30000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={() => window.__tsundokuUpdate?.()}
        className="toast-fade-in pointer-events-auto bg-elev border border-border rounded-full shadow-soft py-2.5 px-4 text-sm text-ink mb-4"
      >
        tsundoku updated · tap to refresh
      </button>
    </div>
  );
}
