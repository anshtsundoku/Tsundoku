import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Domain from './pages/Domain.jsx';
import Sources from './pages/Sources.jsx';
import Settings from './pages/Settings.jsx';
import { applyTheme, currentTheme, syncThemeFromServer } from './lib/theme.js';
import { GearIcon, HomeIcon } from './components/Icons.jsx';

// Brand mark — a single closed book with a bookmark ribbon. Minimal, apt
// for "Tsundoku" (the unread book waiting for you). Uses currentColor so
// it inherits text-wood / text-ink.
export function Brand({ size = 'md' }) {
  const cls =
    size === 'xl' ? 'w-9 h-9'  :
    size === 'lg' ? 'w-7 h-7'  :
    size === 'sm' ? 'w-5 h-5'  : 'w-6 h-6';
  return (
    <svg viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="8" y="5" width="16" height="22" rx="1.5" />
      <line x1="11.5" y1="5" x2="11.5" y2="27" />
      <path d="M17.5 5 L17.5 12 L20 9.5 L22.5 12 L22.5 5" />
    </svg>
  );
}

export default function App() {
  useEffect(() => {
    applyTheme(currentTheme());        // instant — from localStorage cache
    syncThemeFromServer();             // background — pulls cross-device preference
  }, []);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header
        className="sticky top-0 z-20 backdrop-blur bg-bg/85 border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div
          className="max-w-5xl mx-auto py-3 sm:py-4 flex items-center gap-3"
          style={{
            paddingLeft:  'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <Link to="/" className="font-bold tracking-tight flex items-center gap-3">
            <span className="text-wood"><Brand size="xl" /></span>
            <span className="text-2xl sm:text-3xl">Tsundoku</span>
          </Link>
          <div className="flex-1" />
          {loc.pathname !== '/' && (
            <Link to="/" className="p-2.5 sm:p-2 rounded-md hover:bg-elev text-muted" aria-label="Home">
              <HomeIcon className="w-5 h-5" />
            </Link>
          )}
          <Link to="/settings" className="p-2.5 sm:p-2 rounded-md hover:bg-elev text-muted" aria-label="Settings">
            <GearIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>
      <main
        className="max-w-5xl mx-auto py-6 sm:py-10"
        style={{
          paddingLeft:   'max(1rem, env(safe-area-inset-left))',
          paddingRight:  'max(1rem, env(safe-area-inset-right))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/d/:slug"           element={<Domain />} />
          {/* Post detail is its own route so iOS swipe-back returns to the
              feed (not all the way to home) and the page fills the screen
              on desktop. */}
          <Route path="/d/:slug/p/:postId" element={<Domain />} />
          <Route path="/sources"           element={<Sources />} />
          <Route path="/settings"          element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
