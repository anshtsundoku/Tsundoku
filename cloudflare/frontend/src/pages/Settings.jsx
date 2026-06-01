import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Youtube, Mail, Twitter, Sparkles, Check, ChevronDown } from 'lucide-react';
import { api, clearToken } from '../lib/api.js';
import { useUser } from '../App.jsx';
import { logout } from '../lib/auth.js';
import { currentTheme, setTheme as persistTheme } from '../lib/theme.js';
import { currentUiStyle, setUiStyle } from '../lib/uiStyle.js';
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../lib/push.js';

const UI_STYLE_OPTIONS = [
  { key: 'wood',     label: 'Wood' },
  { key: 'swiss',    label: 'Swiss' },
  { key: 'bohemian', label: 'Bohemian' },
];

// Connect-sources cards, in the required order.
const CREDENTIAL_CARDS = [
  { kind: 'yt', title: 'YouTube', Icon: Youtube,
    subtitle: 'watch the channels you actually want, ingested every 15 min.',
    placeholder: 'Paste your API key' },
  { kind: 'gmail', title: 'Gmail', Icon: Mail,
    subtitle: 'forward the newsletters you love; we summarise them as they land.',
    placeholder: 'App password' },
  { kind: 'twitter', title: 'X (Twitter)', Icon: Twitter,
    subtitle: 'follow the accounts that matter, without the doomscroll.',
    twitter: true },
  { kind: 'gemini', title: 'Gemini AI', Icon: Sparkles,
    subtitle: 'optional. lets tsundoku write tldrs for new posts.',
    placeholder: 'Paste your API key' },
];

export default function Settings() {
  const user = useUser();
  const [theme, setLocalTheme] = useState(currentTheme());
  const [uiStyle, setLocalUiStyle] = useState(currentUiStyle());
  const [refreshState, setRefreshState] = useState('idle');  // idle | loading | done | error
  const [showDelete, setShowDelete] = useState(false);

  const doLogout = async () => { await logout(); window.location.reload(); };

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

      <ConnectSources />

      <Section title="Notifications">
        <Row
          label="Push for every new post"
          desc={pushError ? pushError : pushLabel}
          right={pushCta}
          bordered={push.subscribed}
        />
        {push.subscribed && (
          <Row
            label="Per-source control"
            desc="silence specific sources without turning off push entirely."
            right={
              <Link to="/sources" className="eyebrow text-wood hover:underline whitespace-nowrap">
                Manage →
              </Link>
            }
          />
        )}
        {push.supported && push.configured && push.permission !== 'denied' && (
          <p className="text-xs text-muted pb-3 -mt-2">
            Tip: on iPhone, install Tsundoku to your home screen first (Share → Add to Home Screen). Push only works from the installed app.
          </p>
        )}
      </Section>

      <Section title="Appearance">
        <div className="py-4 border-b border-border">
          <div className="font-bold tracking-tight">Look &amp; feel</div>
          <div className="text-sm text-muted leading-snug mb-3">
            Switch the entire interface. Wood is the original warm theme, Swiss is the typographic grid, Bohemian is the eclectic serif look.
          </div>
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

      <Section title="Account">
        <Row
          label="Signed in as"
          desc={user?.email || '—'}
          right={user?.picture
            ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border border-border" />
            : null}
          bordered
        />
        <Row
          label="Log out"
          desc="Sign out of Tsundoku on this device."
          right={
            <button
              onClick={doLogout}
              className="text-xs tt-label tracking-eyebrow font-bold px-3 py-1.5 border border-ink text-ink hover:bg-ink hover:text-bg transition-colors"
            >
              Log out
            </button>
          }
          bordered
        />
        <Row
          label="Delete account"
          desc="Permanently erase everything you've saved. There's no undo."
          right={
            <button
              onClick={() => setShowDelete(true)}
              className="text-xs tt-label tracking-eyebrow font-bold px-3 py-1.5 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
            >
              Delete…
            </button>
          }
        />
      </Section>

      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}

function DeleteAccountModal({ onClose }) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canDelete = confirm.trim().toLowerCase() === 'delete';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doDelete = async () => {
    if (!canDelete) return;
    setBusy(true); setError(null);
    try {
      await api.deleteAccount();
      clearToken();
      window.location.reload();
    } catch (e) {
      setError(e.message || 'could not delete account');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div className="bg-elev border border-border max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold tt-title text-lg text-red-600 tracking-tight">Delete account</h3>
        <p className="text-sm text-muted leading-snug mt-2">
          this will permanently delete your domains, sources, posts, bookmarks, push subscriptions, and credentials. there's no undo.
        </p>
        <label className="block text-xs text-muted mt-4 mb-1">
          type <span className="font-bold text-ink">delete</span> to confirm
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoFocus
          placeholder="delete"
          className="w-full bg-bg border border-border px-3 py-2 text-ink text-sm"
        />
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs tt-label tracking-eyebrow font-bold px-3 py-2 text-muted hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={doDelete}
            disabled={!canDelete || busy}
            className="text-xs tt-label tracking-eyebrow font-bold px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectSources() {
  const [status, setStatus] = useState(null);   // { yt, gmail, twitter, gemini } booleans
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.getCredentials().then(setStatus).catch(() => setStatus({}));
  }, []);

  const toggle = (k) => setOpen(o => (o === k ? null : k));
  const onSaved = (k) => { setStatus(s => ({ ...s, [k]: true })); setOpen(null); };
  const onDisconnected = (k) => setStatus(s => ({ ...s, [k]: false }));

  return (
    <Section title="Connect sources">
      {CREDENTIAL_CARDS.map(card => (
        <CredentialCard
          key={card.kind}
          card={card}
          configured={Boolean(status?.[card.kind])}
          open={open === card.kind}
          onToggle={() => toggle(card.kind)}
          onSaved={onSaved}
          onDisconnected={onDisconnected}
        />
      ))}
    </Section>
  );
}

function CredentialCard({ card, configured, open, onToggle, onSaved, onDisconnected }) {
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const Icon = card.Icon;

  const canSave = card.twitter
    ? Boolean(fields.auth_token?.trim() && fields.ct0?.trim())
    : Boolean(fields.value?.trim());

  const save = async () => {
    if (!canSave) return;
    setBusy(true); setError(null);
    try {
      const value = card.twitter
        ? { auth_token: fields.auth_token.trim(), ct0: fields.ct0.trim() }
        : fields.value.trim();
      await api.patchCredential(card.kind, value);
      setFields({});           // never keep the secret around
      onSaved(card.kind);
    } catch (e) {
      setError(e.message || 'could not save');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true); setError(null);
    try {
      await api.deleteCredential(card.kind);
      setFields({});
      onDisconnected(card.kind);
    } catch (e) {
      setError(e.message || 'could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  const SaveBtn = (
    <button
      type="button"
      onClick={save}
      disabled={!canSave || busy}
      className="shrink-0 bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2 hover:bg-wood-2 disabled:opacity-50 transition-colors"
    >
      {busy ? '…' : 'Save'}
    </button>
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 py-4 text-left">
        <span className="text-wood shrink-0"><Icon className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight flex items-center gap-2">
            <span>{card.title}</span>
            {configured
              ? <Check className="w-4 h-4 text-green-600" aria-label="connected" />
              : <span className="inline-block w-2 h-2 rounded-full bg-muted/40" aria-label="not connected" />}
          </div>
          <div className="text-xs text-muted leading-snug">{card.subtitle}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="pb-4 space-y-3">
          {/* Setup guide placeholder. */}
          <div
            className="flex items-center justify-center text-center border border-line bg-bg/40 text-muted text-xs px-3"
            style={{ minHeight: 80 }}
          >
            Setup guides will come here
          </div>

          {card.twitter ? (
            <div className="space-y-2">
              <input
                type="password" autoComplete="off" placeholder="auth_token"
                value={fields.auth_token || ''}
                onChange={e => setFields(f => ({ ...f, auth_token: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 text-ink text-sm font-mono"
              />
              <div className="flex gap-2">
                <input
                  type="password" autoComplete="off" placeholder="ct0"
                  value={fields.ct0 || ''}
                  onChange={e => setFields(f => ({ ...f, ct0: e.target.value }))}
                  className="flex-1 min-w-0 bg-bg border border-border px-3 py-2 text-ink text-sm font-mono"
                />
                {SaveBtn}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password" autoComplete="off" placeholder={card.placeholder}
                value={fields.value || ''}
                onChange={e => setFields(f => ({ ...f, value: e.target.value }))}
                className="flex-1 min-w-0 bg-bg border border-border px-3 py-2 text-ink text-sm font-mono"
              />
              {SaveBtn}
            </div>
          )}

          {error && <div className="text-xs text-wood">{error}</div>}

          {configured && (
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="text-xs text-muted hover:text-wood underline disabled:opacity-50"
            >
              Disconnect
            </button>
          )}
        </div>
      )}
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
