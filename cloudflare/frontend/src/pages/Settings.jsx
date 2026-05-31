import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { currentTheme, setTheme as persistTheme } from '../lib/theme.js';
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../lib/push.js';

export default function Settings() {
  const [theme, setLocalTheme] = useState(currentTheme());
  const [refreshState, setRefreshState] = useState('idle');  // idle | loading | done | error

  // Push notifications state
  const [push, setPush] = useState({ supported: false, configured: false, subscribed: false, permission: 'default' });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(null);

  // When the toggle is clicked, apply theme locally AND sync to server so
  // the choice carries across devices.
  const changeTheme = (t) => { setLocalTheme(t); persistTheme(t); };

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
        className="text-sm bg-wood text-bg font-bold px-3 py-1.5 rounded-md hover:bg-wood-2 disabled:opacity-50"
      >
        {pushBusy ? '…' : push.subscribed ? 'Turn off' : 'Turn on'}
      </button>
    );
  })();

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="text-sm text-muted hover:text-ink">← Home</Link>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight mb-8">Settings</h1>

      <Section title="Appearance">
        <Row
          label="Theme"
          desc="Light or dark — both use the same warm wood + cream palette."
          right={
            <div className="flex bg-bg border border-border rounded-lg p-0.5">
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
          right={<Link to="/sources" className="text-sm text-wood font-bold hover:underline">Manage →</Link>}
          bordered
        />
        <Row
          label="Refresh feed"
          desc="Pull the latest from every source right now (otherwise it polls in the background)."
          right={
            <button
              onClick={triggerRefresh}
              disabled={refreshState === 'loading'}
              className="text-sm bg-wood text-bg font-bold px-3 py-1.5 rounded-md hover:bg-wood-2 disabled:opacity-50"
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
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-wider text-wood font-bold mb-2 ml-1">{title}</h2>
      <div className="bg-elev border border-border rounded-xl px-4">
        {children}
      </div>
    </section>
  );
}

function Row({ label, desc, right, bordered }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-4 ${bordered ? 'border-b border-border' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted leading-snug">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function SegBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition ${active ? 'bg-elev text-ink font-medium' : 'text-muted hover:text-ink'}`}
    >
      {children}
    </button>
  );
}
