import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { currentTheme, setTheme as persistTheme } from '../lib/theme.js';
import { currentUiStyle, setUiStyle } from '../lib/uiStyle.js';
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../lib/push.js';

const UI_STYLE_OPTIONS = [
  { key: 'wood',     label: 'Wood' },
  { key: 'swiss',    label: 'Swiss' },
  { key: 'bohemian', label: 'Bohemian' },
];

export default function Settings() {
  const [theme, setLocalTheme] = useState(currentTheme());
  const [uiStyle, setLocalUiStyle] = useState(currentUiStyle());
  const [refreshState, setRefreshState] = useState('idle');  // idle | loading | done | error

  // Push notifications state
  const [push, setPush] = useState({ supported: false, configured: false, subscribed: false, permission: 'default' });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(null);

  // When the toggle is clicked, apply theme locally AND sync to server so
  // the choice carries across devices.
  const changeTheme = (t) => { setLocalTheme(t); persistTheme(t); };
  const changeUiStyle = (s) => { setLocalUiStyle(s); setUiStyle(s); };

  const reloadPush = async () => {
    try { setPush(await getPushStatus()); } catch (e) { console.warn(e); }
  };

  useEffect(() => { reloadPush(); }, []);

  const togglePush = async () => {
    setPushError(null);
    setPushBusy(true);
    try {
      if (push.subscribed) {
        await unsubscribeFromPush();
      } else {
        await subscribeToPush();
      }
      await reloadPush();
    } catch (e) {
      setPushError(e.message || 'Failed.');
    } finally {
      setPushBusy(false);
    }
  };

  const triggerRefresh = async () => {
    setRefreshState('loading');
    try {
      const res = await fetch('/api/admin/trigger-ingest', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setRefreshState('done');
    } catch (e) {
      console.error(e);
      setRefreshState('error');
    }
    setTimeout(() => setRefreshState('idle'), 3500);
  };

  // Decide what the notifications row should say
  const pushLabel = (() => {
    if (!push.supported) return 'Not supported on this browser';
    if (!push.configured) return 'Server not configured';
    if (push.permission === 'denied') return 'Blocked in browser settings';
    if (push.subscribed) return 'On — pinging this device';
    return 'Off';
  })();

  const pushCta = (() => {
    if (!push.supported || !push.configured || push.permission === 'denied') return null;
    return (
      <button
        onClick={togglePush}
        disabled={pushBusy}
        className="text-xs tt-label tracking-eyebrow bg-wood text-bg font-bold px-3 py-1.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
      >
        {pushBusy ? '…' : push.subscribed ? 'Turn off' : 'Turn on'}
      </button>
    );
  })();

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Home</Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none mb-8 break-words">Settings</h1>

      <Section title="Interface style">
        <div className="py-4">
          <div className="font-bold tracking-tight">Look &amp; feel</div>
          <div className="text-sm text-muted leading-snug mb-3">
            Switch the entire interface. Wood is the original warm theme, Swiss is the typographic grid, Bohemian is the eclectic serif look.
          </div>
          {/* Full-width segmented control: the three options share the row and
              never overflow on narrow phones. */}
          <div className="flex border border-line w-full max-w-full overflow-hidden">
            {UI_STYLE_OPTIONS.map(o => (
              <SegBtn
                key={o.key}
                active={uiStyle === o.key}
                onClick={() => changeUiStyle(o.key)}
                className="flex-1 text-center"
              >
                {o.label}
              </SegBtn>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <Row
          label="Theme"
          desc="Light or dark — each interface style has its own matching palette."
          right={
            <div className="flex border border-line">
              <SegBtn active={theme === 'light'} onClick={() => changeTheme('light')}>Light</SegBtn>
              <SegBtn active={theme === 'dark'}  onClick={() => changeTheme('dark')}>Dark</SegBtn>
            </div>
          }
        />
      </Section>

      <Section title="Notifications">
        <Row
          label="Push for every new post"
          desc={pushError ? pushError : pushLabel}
          right={pushCta}
        />
        {push.supported && push.configured && push.permission !== 'denied' && (
          <p className="text-xs text-muted pb-3 -mt-2">
            Tip: on iPhone, install Tsundoku to your home screen first (Share → Add to Home Screen). Push only works from the installed app.
          </p>
        )}
      </Section>

      <Section title="Content">
        <Row
          label="Sources"
          desc="Add or remove the websites, newsletters, YouTube channels and X accounts you follow."
          right={<Link to="/sources" className="eyebrow text-wood hover:underline">Manage →</Link>}
          bordered
        />
        <Row
          label="Refresh feed"
          desc="Pull the latest from every source right now (otherwise it polls in the background)."
          right={
            <button
              onClick={triggerRefresh}
              disabled={refreshState === 'loading'}
              className="text-xs tt-label tracking-eyebrow bg-wood text-bg font-bold px-3 py-1.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
            >
              {refreshState === 'loading' ? 'Refreshing…'
               : refreshState === 'done'  ? '✓ Triggered'
               : refreshState === 'error' ? 'Error — retry'
               : 'Refresh now'}
            </button>
          }
        />
      </Section>

      <Section title="About">
        <div className="py-4 text-sm text-muted leading-relaxed">
          <p className="mb-2">
            <strong className="text-ink">Tsundoku</strong> — Japanese for the act of acquiring books and letting them pile up unread.
          </p>
          <p>A quiet feed of the few sources you trust. Read deliberately.</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="eyebrow text-wood mb-2 pb-2 border-b border-line">{title}</h2>
      <div className="bg-elev border border-border px-4">
        {children}
      </div>
    </section>
  );
}

function Row({ label, desc, right, bordered }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-4 ${bordered ? 'border-b border-border' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-bold tracking-tight">{label}</div>
        <div className="text-sm text-muted leading-snug">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function SegBtn({ active, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs tt-label tracking-eyebrow font-bold transition-colors ${active ? 'bg-ink text-bg' : 'text-muted hover:text-ink'} ${className}`}
    >
      {children}
    </button>
  );
}
