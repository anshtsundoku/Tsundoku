import { useEffect, useRef, useState } from 'react';
import { Brand, LegalFooter } from '../App.jsx';
import { signInWithGoogle } from '../lib/auth.js';

// OAuth client ids are public identifiers (not secrets). Prefer the build-time
// env var; fall back to the known web client id so the deployed Landing page
// works even if the Pages env var hasn't been set.
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '108209583660-qfjpt2420aie69uf73a17qge34u32v5m.apps.googleusercontent.com';

export default function Landing() {
  const [error, setError] = useState(null);
  const [showFallback, setShowFallback] = useState(false);
  const btnRef = useRef(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID) console.warn('[auth] VITE_GOOGLE_CLIENT_ID is not set');
    // If Google shows origin_mismatch, copy this exact string into Cloud Console →
    // Credentials → your Web client → Authorized JavaScript origins (no trailing slash).
    console.info('[auth] add to Authorized JavaScript origins:', window.location.origin);
    console.info('[auth] OAuth client id:', CLIENT_ID);

    const onCredential = async (resp) => {
      try {
        await signInWithGoogle(resp.credential);
      } catch (e) {
        setError(e.message || 'sign-in failed — please try again');
      }
    };

    const init = () => {
      if (inited.current) return true;
      const gid = window.google?.accounts?.id;
      if (!gid || !CLIENT_ID) return false;
      gid.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: false });
      // Reliable, always-present control.
      if (btnRef.current) {
        gid.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with',
        });
      }
      // One Tap, rendered automatically in the corner.
      gid.prompt();
      inited.current = true;
      return true;
    };

    // The GIS script loads async — poll briefly until it's ready.
    let poll;
    if (!init()) {
      poll = setInterval(() => { if (init()) clearInterval(poll); }, 200);
      setTimeout(() => poll && clearInterval(poll), 8000);
    }
    // If One Tap hasn't surfaced within 3s, reveal the manual prompt button.
    const t = setTimeout(() => setShowFallback(true), 3000);
    return () => { clearTimeout(t); poll && clearInterval(poll); };
  }, []);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="text-wood mb-7"><Brand size="hero" /></div>
      <h1 className="text-4xl sm:text-5xl font-bold tt-title tracking-tight leading-none">Tsundoku</h1>
      <p className="mt-4 text-muted text-base sm:text-lg">the unread pile, made gentle.</p>

      <p className="mt-6 text-sm text-muted max-w-md mx-auto mb-8">
        tsundoku is a personal project run for friends and family. your data lives on cloudflare's free tier and is never sold or shared. delete your account any time from settings.
      </p>

      {/* Legal agreement — tiny, above the sign-in widget. */}
      <p className="mt-10 text-xs text-muted max-w-xs">
        by signing in, you agree to our{' '}
        <a href="/terms" target="_blank" rel="noreferrer" className="text-wood underline">terms</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank" rel="noreferrer" className="text-wood underline">privacy policy</a>
      </p>

      {/* Google sign-in widget (One Tap + the official button). */}
      <div ref={btnRef} className="mt-4 min-h-[44px] flex items-center justify-center" />

      {error && <p className="mt-6 text-xs text-wood max-w-sm">{error}</p>}

      {/* Non-clickable fallback messaging — no alternate auth path. */}
      {showFallback && (
        <p className="mt-6 text-xs text-muted max-w-xs">
          sign-in widget didn&apos;t load? refresh the page or try another browser.
        </p>
      )}

      <LegalFooter className="mt-16" />
    </main>
  );
}
