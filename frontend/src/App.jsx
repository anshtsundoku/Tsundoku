import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Domain from './pages/Domain.jsx';
import Sources from './pages/Sources.jsx';
import { applyTheme, currentTheme, toggleTheme } from './lib/theme.js';
import { SunIcon, MoonIcon, GearIcon, HomeIcon } from './components/Icons.jsx';

export default function App() {
  const [theme, setTheme] = useState(currentTheme());
  const loc = useLocation();

  useEffect(() => { applyTheme(theme); }, [theme]);

  const onToggle = () => {
    toggleTheme();
    setTheme(currentTheme());
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 backdrop-blur bg-bg/85 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="font-bold tracking-tight text-lg flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-wood" />
            Mindful
          </Link>
          <div className="flex-1" />
          {loc.pathname !== '/' && (
            <Link to="/" className="p-2 rounded-md hover:bg-elev text-muted" aria-label="Home">
              <HomeIcon className="w-5 h-5" />
            </Link>
          )}
          <Link to="/sources" className="p-2 rounded-md hover:bg-elev text-muted" aria-label="Sources">
            <GearIcon className="w-5 h-5" />
          </Link>
          <button onClick={onToggle} className="p-2 rounded-md hover:bg-elev text-muted" aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/d/:slug" element={<Domain />} />
          <Route path="/sources" element={<Sources />} />
        </Routes>
      </main>
    </div>
  );
}
