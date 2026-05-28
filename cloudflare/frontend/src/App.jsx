import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Domain from './pages/Domain.jsx';
import Sources from './pages/Sources.jsx';
import Settings from './pages/Settings.jsx';
import { applyTheme, currentTheme } from './lib/theme.js';
import { GearIcon, HomeIcon } from './components/Icons.jsx';

// Brand mark — refined stack of three books with a subtle tilt on top.
// Uses currentColor so it inherits text-wood / etc.
export function Brand({ size = 'md' }) {
  const cls = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  return (
    <svg viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="6.5" y="20"   width="20" height="4.5" rx="0.5" />
      <rect x="4.5" y="14.5" width="22" height="4.5" rx="0.5" />
      <g transform="rotate(-3 17 11.25)">
        <rect x="8" y="9" width="18" height="4.5" rx="0.5" />
      </g>
    </svg>
  );
}

export default function App() {
  useEffect(() => { applyTheme(currentTheme()); }, []);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 backdrop-blur bg-bg/85 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Link to="/" className="font-bold tracking-tight flex items-center gap-2.5">
            <span className="text-wood"><Brand size="md" /></span>
            <span className="text-base sm:text-lg">Tsundoku</span>
          </Link>
          <div className="flex-1" />
          {loc.pathname !== '/' && (
            <Link to="/" className="p-2 rounded-md hover:bg-elev text-muted" aria-label="Home">
              <HomeIcon className="w-5 h-5" />
            </Link>
          )}
          <Link to="/settings" className="p-2 rounded-md hover:bg-elev text-muted" aria-label="Settings">
            <GearIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/d/:slug"    element={<Domain />} />
          <Route path="/sources"    element={<Sources />} />
          <Route path="/settings"   element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
