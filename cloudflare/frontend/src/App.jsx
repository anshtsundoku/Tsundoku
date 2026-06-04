import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Domain from './pages/Domain.jsx';
import Sources from './pages/Sources.jsx';
import Settings from './pages/Settings.jsx';
import TypeFeed from './pages/TypeFeed.jsx';
import Search   from './pages/Search.jsx';
import Library  from './pages/Library.jsx';
import Landing    from './pages/Landing.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Privacy    from './pages/Privacy.jsx';
import Terms      from './pages/Terms.jsx';
import ExtensionPair from './pages/ExtensionPair.jsx';
import { applyTheme, currentTheme, syncThemeFromServer } from './lib/theme.js';
import { applyUiStyle, currentUiStyle, syncUiStyleFromServer } from './lib/uiStyle.js';
import { me } from './lib/auth.js';
import { GearIcon, HomeIcon, SearchIcon, LibraryIcon } from './components/Icons.jsx';

// Signed-in user + setter (onboarding completion updates without full reload).
const UserContext = createContext(null);
export function useUser() { return useContext(UserContext)?.user ?? null; }
export function useSetUser() { return useContext(UserContext)?.setUser; }

// Brand mark — a single closed book with a bookmark ribbon. Minimal, apt
// for "Tsundoku" (the unread book waiting for you). Uses currentColor so
// it inherits text-wood / text-ink.
export function Brand({ size = 'md' }) {
  const cls =
    size === 'hero' ? 'w-20 h-20' :
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

// Tiny legal disclosure footer (privacy · terms). Deliberately low-key.
export function LegalFooter({ className = '' }) {
  return (
    <footer className={`text-xs text-muted/70 flex items-center justify-center gap-2 ${className}`}>
      <Link to="/privacy" className="hover:text-ink transition-colors">privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms" className="hover:text-ink transition-colors">terms</Link>
    </footer>
  );
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-line border-t-wood rounded-full animate-spin" aria-label="loading" />
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading');  // loading | authed | anon
  const [user, setUser] = useState(null);

  // Apply the cached skin/theme immediately (matches the inline bootstrap in
  // index.html), regardless of auth — the Landing page should look right too.
  useEffect(() => {
    applyUiStyle(currentUiStyle());
    applyTheme(currentTheme());
  }, []);

  // Resolve the session once on mount.
  useEffect(() => {
    let alive = true;
    me().then((u) => {
      if (!alive) return;
      if (u) {
        setUser(u);
        setAuthState('authed');
        // Cross-device preferences require auth — pull them now.
        syncThemeFromServer();
        syncUiStyleFromServer();
      } else {
        setAuthState('anon');
      }
    });
    return () => { alive = false; };
  }, []);

  if (authState === 'loading') return <FullScreenSpinner />;

  // Signed out: only the Landing page and the public stub pages mount.
  if (authState === 'anon') {
    return (
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms"   element={<Terms />} />
        <Route path="*"        element={<Landing />} />
      </Routes>
    );
  }

  const needsOnboarding = !user.onboarded_at;

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Routes>
        <Route
          path="/onboarding"
          element={needsOnboarding ? <Onboarding /> : <Navigate to="/" replace />}
        />
        {/* Standalone — bypasses onboarding redirect and the app shell. The
            page self-guards via me(). The browser extension's content script
            runs on this URL. */}
        <Route path="/extension-pair" element={<ExtensionPair />} />
        <Route
          path="*"
          element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <AppShell />}
        />
      </Routes>
    </UserContext.Provider>
  );
}

function AppShell() {
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header
        className="sticky top-0 z-20 bg-bg border-b-2 border-line"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div
          className="max-w-5xl mx-auto py-3 sm:py-4 flex items-center gap-3"
          style={{
            paddingLeft:  'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-wood"><Brand size="xl" /></span>
            <span className="text-2xl sm:text-3xl font-bold tt-title tracking-tight leading-none">Tsundoku</span>
          </Link>
          <div className="flex-1" />
          {loc.pathname !== '/' && (
            <Link to="/" className="p-2.5 sm:p-2 border border-transparent hover:border-ink text-ink transition-colors" aria-label="Home">
              <HomeIcon className="w-5 h-5" />
            </Link>
          )}
          <Link to="/search" className="p-2.5 sm:p-2 border border-transparent hover:border-ink text-ink transition-colors" aria-label="Search">
            <SearchIcon className="w-5 h-5" />
          </Link>
          <Link to="/library" className="p-2.5 sm:p-2 border border-transparent hover:border-ink text-ink transition-colors" aria-label="Library">
            <LibraryIcon className="w-5 h-5" />
          </Link>
          <Link to="/settings" className="p-2.5 sm:p-2 border border-transparent hover:border-ink text-ink transition-colors" aria-label="Settings">
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
          {/* Cross-domain feed filtered by a single source type
              (from the "New Reads / Watches" pills on Home). */}
          <Route path="/t/:type"           element={<TypeFeed />} />
          <Route path="/t/:type/p/:postId" element={<TypeFeed />} />
          <Route path="/search"            element={<Search />} />
          <Route path="/library"           element={<Library />} />
          <Route path="/sources"           element={<Sources />} />
          <Route path="/settings"          element={<Settings />} />
          <Route path="/privacy"           element={<Privacy />} />
          <Route path="/terms"             element={<Terms />} />
        </Routes>
        <LegalFooter className="mt-12 pt-6" />
      </main>
    </div>
  );
}
