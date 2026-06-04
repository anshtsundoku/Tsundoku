import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { me } from '../lib/auth.js';
import { Brand } from '../App.jsx';

// Standalone pairing page (route /extension-pair). The Tsundoku browser
// extension's content script runs on this URL and listens for the token we
// postMessage after the user approves.
export default function ExtensionPair() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | pairing | connected | waiting
  const [error, setError] = useState(null);
  const waitTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    me().then((u) => {
      if (!alive) return;
      if (!u) { navigate('/', { replace: true }); return; }
      setUser(u);
      setPhase('ready');
    });
    return () => { alive = false; };
  }, [navigate]);

  // Listen for the extension's confirmation that it stored the token.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source === 'tsundoku-ext-installed' && event.data?.ok) {
        if (waitTimer.current) clearTimeout(waitTimer.current);
        setPhase('connected');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const approve = async () => {
    setError(null);
    setPhase('pairing');
    try {
      const { token } = await api.pairExtension({ name: navigator.userAgent });
      // Hand the token to the extension content script (same-origin).
      window.postMessage(
        { source: 'tsundoku-pair', token, userEmail: user?.email },
        window.location.origin,
      );
      setPhase('waiting');
      // If the extension never answers, it's probably not installed/active.
      waitTimer.current = setTimeout(() => {
        setPhase((p) => (p === 'waiting' ? 'timeout' : p));
      }, 5000);
    } catch (e) {
      setError(e.message || 'could not start pairing');
      setPhase('ready');
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-wood mb-7 flex justify-center"><Brand size="hero" /></div>

        {phase === 'connected' ? (
          <>
            <h1 className="text-3xl font-bold tt-title tracking-tight lowercase">connected.</h1>
            <p className="mt-4 text-sm text-muted leading-relaxed">close this tab.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tt-title tracking-tight lowercase">pair browser extension</h1>
            <p className="mt-4 text-sm text-muted leading-relaxed">
              this gives the tsundoku browser extension permission to sync your x cookies automatically.
            </p>

            <button
              type="button"
              onClick={approve}
              disabled={phase === 'loading' || phase === 'pairing'}
              className="mt-8 w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-50 transition-colors"
            >
              {phase === 'pairing' ? 'connecting…' : 'approve and connect'}
            </button>

            {phase === 'waiting' && (
              <p className="mt-5 text-xs text-muted">waiting for the extension…</p>
            )}
            {phase === 'timeout' && (
              <p className="mt-5 text-xs text-muted leading-relaxed">
                didn&apos;t see the extension respond. make sure the tsundoku extension is installed and active, then refresh this page.
              </p>
            )}
            {error && <p className="mt-5 text-xs text-wood">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
