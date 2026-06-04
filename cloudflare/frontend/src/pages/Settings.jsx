import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Youtube, Mail, Twitter, Sparkles } from 'lucide-react';
import { api, clearToken } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { useUser } from '../App.jsx';
import { logout } from '../lib/auth.js';
import { currentTheme, setTheme as persistTheme } from '../lib/theme.js';
import { currentUiStyle, setUiStyle } from '../lib/uiStyle.js';
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from '../lib/push.js';
import GuideToggle from '../components/setup-guides/GuideToggle.jsx';
import YoutubeGuide from '../components/setup-guides/YoutubeGuide.jsx';
import GeminiGuide from '../components/setup-guides/GeminiGuide.jsx';
import XGuide from '../components/setup-guides/XGuide.jsx';

// Which inline guide each credential card exposes via "how do I get this?".
const GUIDES = { yt: YoutubeGuide, gemini: GeminiGuide, twitter: XGuide };

// D1 stores timestamps as "YYYY-MM-DD HH:MM:SS" (UTC, no zone). Render relative.
function relTime(s) {
  if (!s) return 'never';
  const t = new Date(String(s).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(t)) return String(s);
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncateName(name) {
  const n = (name || 'browser extension').trim();
  return n.length > 40 ? `${n.slice(0, 40)}…` : n;
}

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
    disabled: true,
    body: "newsletters belong in tsundoku, not your inbox. we're working on the cleanest way to connect gmail — for now, this lives on hold." },
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
  const [exporting, setExporting] = useState(false);

  // Browser-extension pairings (shared by the X card + the dedicated section).
  const [pairings, setPairings] = useState([]);
  const loadPairings = async () => {
    try { setPairings(await api.listPairings() || []); } catch { setPairings([]); }
  };
  const revokePairing = async (id) => {
    try { await api.revokePairing(id); } catch { /* ignore */ }
    await loadPairings();
  };
  useEffect(() => { loadPairings(); }, []);

  const doLogout = async () => { await logout(); window.location.reload(); };

  // Push notifications state
  const [push, setPush] = useState({ supported: false, iosNeedsInstall: false, configured: false, subscribed: false, permission: 'default' });
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

  // Download a full JSON export of the user's data. request() handles auth, so
  // we just turn the returned object into a Blob and trigger a download.
  const downloadExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `tsundoku-export-${ymd}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast('export failed. try again?', { kind: 'error' });
    } finally {
      setExporting(false);
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

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← Home</Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none mb-8 break-words">Settings</h1>

      <ConnectSources pairings={pairings} onRevokePairing={revokePairing} />

      <Section title="Notifications">
        {(() => {
          // State 1 — this browser can't do web push at all.
          if (!push.supported || !push.configured) {
            return (
              <Row
                label="Push"
                desc={!push.supported
                  ? 'not supported on this browser.'
                  : "push isn't configured on the server yet."}
              />
            );
          }

          // State 3 — notifications are blocked in browser/OS settings.
          if (push.permission === 'denied') {
            return (
              <Row
                label="Push"
                desc="blocked in your browser settings. allow notifications for tsundoku, then reload."
              />
            );
          }

          // State 5 — subscribed on this device. Checked before iosNeedsInstall
          // so an installed iphone keeps full per-device control.
          if (push.subscribed) {
            return (
              <>
                <Row
                  label="Push"
                  desc={pushError ? pushError : 'on — pinging this device.'}
                  right={
                    <button
                      onClick={togglePush}
                      disabled={pushBusy}
                      className="eyebrow text-wood hover:underline whitespace-nowrap disabled:opacity-50"
                    >
                      {pushBusy ? '…' : 'turn off'}
                    </button>
                  }
                  bordered
                />
                <Row
                  label="Per-source control"
                  desc="silence specific sources without turning off push entirely."
                  right={
                    <Link to="/sources" className="eyebrow text-wood hover:underline whitespace-nowrap">
                      Manage →
                    </Link>
                  }
                />
              </>
            );
          }

          // State 2 — iphone safari that isn't installed to the home screen.
          // No button: subscribing can't work until it's a home-screen app.
          if (push.iosNeedsInstall) {
            return (
              <Row
                label="Push"
                desc="install tsundoku to your home screen to enable push on iphone. tap share → add to home screen."
              />
            );
          }

          // State 4 — supported, allowed, not yet subscribed.
          return (
            <Row
              label="Push"
              desc={pushError ? pushError : 'get a quiet ping when something new shows up.'}
              right={
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  className="text-xs tt-label tracking-eyebrow bg-wood text-bg font-bold px-3 py-1.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
                >
                  {pushBusy ? '…' : 'turn on'}
                </button>
              }
            />
          );
        })()}
      </Section>

      <BrowserExtensions pairings={pairings} onRevoke={revokePairing} />

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
          desc="Light, dark, or auto — auto follows your system. Each interface style has its own matching palette."
          right={
            <div className="flex border border-line">
              <SegBtn active={theme === 'light'} onClick={() => changeTheme('light')}>Light</SegBtn>
              <SegBtn active={theme === 'dark'}  onClick={() => changeTheme('dark')}>Dark</SegBtn>
              <SegBtn active={theme === 'auto'}  onClick={() => changeTheme('auto')}>Auto</SegBtn>
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
          <p className="text-muted text-xs mt-3">version {import.meta.env.VITE_APP_VERSION}</p>
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
          label="export your data"
          desc="download everything as json — posts, highlights, bookmarks, sources, domains. credentials excluded."
          right={
            <button
              onClick={downloadExport}
              disabled={exporting}
              className="text-sm text-wood font-bold hover:underline disabled:opacity-50"
            >
              {exporting ? '…' : 'download json'}
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
        <p className="text-xs text-muted leading-snug mt-2">
          see our <a href="/privacy" target="_blank" rel="noreferrer" className="text-wood underline">privacy policy</a> for what 'delete' covers.
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

function BrowserExtensions({ pairings, onRevoke }) {
  const [busyId, setBusyId] = useState(null);

  const revoke = async (id) => {
    setBusyId(id);
    try { await onRevoke(id); } finally { setBusyId(null); }
  };

  return (
    <Section title="Browser extensions">
      {(!pairings || pairings.length === 0) ? (
        <div className="py-4 text-sm text-muted leading-snug">
          no browser extensions paired yet. install the tsundoku extension to sync x cookies automatically.{' '}
          <Link to="/extension-pair" className="text-wood hover:underline whitespace-nowrap">pair now →</Link>
        </div>
      ) : (
        pairings.map((p, i) => (
          <Row
            key={p.id}
            label={truncateName(p.name)}
            desc={`paired ${relTime(p.created_at)} · last sync ${relTime(p.last_used_at)}`}
            right={
              <button
                type="button"
                onClick={() => revoke(p.id)}
                disabled={busyId === p.id}
                className="text-xs text-muted hover:text-wood underline disabled:opacity-50"
              >
                {busyId === p.id ? '…' : 'revoke'}
              </button>
            }
            bordered={i < pairings.length - 1}
          />
        ))
      )}
    </Section>
  );
}

function ConnectSources({ pairings, onRevokePairing }) {
  const [status, setStatus] = useState(null);
  const [editingConnected, setEditingConnected] = useState(null);

  useEffect(() => {
    api.getCredentials().then(setStatus).catch(() => setStatus({}));
  }, []);

  const onSaved = (k) => {
    setStatus(s => ({ ...s, [k]: true }));
    setEditingConnected(null);
  };
  const onDisconnected = (k) => {
    setStatus(s => ({ ...s, [k]: false }));
    setEditingConnected(null);
  };

  // Soft-disabled cards (e.g. Gmail) always live in Pending and never show as
  // connected, regardless of any stored credential.
  const pending = CREDENTIAL_CARDS.filter(c => c.disabled || !status?.[c.kind]);
  const connected = CREDENTIAL_CARDS.filter(c => !c.disabled && status?.[c.kind]);

  return (
    <Section title="Connect sources">
      {pending.length > 0 && (
        <>
          <h3 className="eyebrow text-muted text-[10px] pt-3 pb-2 border-b border-border">Pending</h3>
          {pending.map(card => (
            <PendingCredentialForm
              key={card.kind}
              card={card}
              onSaved={onSaved}
              pairings={card.twitter ? pairings : undefined}
              onRevokePairing={onRevokePairing}
            />
          ))}
        </>
      )}
      {connected.length > 0 && (
        <>
          <h3 className="eyebrow text-muted text-[10px] pt-4 pb-2 border-b border-border">Connected</h3>
          <div className="py-3 flex flex-wrap gap-2">
            {connected.map(card => (
              <ConnectedChip
                key={card.kind}
                card={card}
                active={editingConnected === card.kind}
                onSelect={() => setEditingConnected(k => (k === card.kind ? null : card.kind))}
                onDisconnected={() => onDisconnected(card.kind)}
              />
            ))}
          </div>
          {editingConnected && (
            <PendingCredentialForm
              card={CREDENTIAL_CARDS.find(c => c.kind === editingConnected)}
              onSaved={onSaved}
              onDisconnect={() => onDisconnected(editingConnected)}
              updateMode
              pairings={editingConnected === 'twitter' ? pairings : undefined}
              onRevokePairing={onRevokePairing}
            />
          )}
        </>
      )}
    </Section>
  );
}

function PendingCredentialForm({ card, onSaved, onDisconnect, updateMode, pairings, onRevokePairing }) {
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // For X: manual cookie entry is collapsed by default (extension is preferred),
  // but expanded when editing an already-connected credential.
  const [showManual, setShowManual] = useState(Boolean(updateMode));
  if (!card) return null;
  const Icon = card.Icon;
  const GuideComp = GUIDES[card.kind];
  const guideEl = GuideComp ? <GuideToggle><GuideComp /></GuideToggle> : null;

  // Soft-disabled cards (e.g. Gmail): explanatory copy only, no input/save.
  if (card.disabled) {
    return (
      <div className="py-4 border-b border-border last:border-b-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-wood shrink-0"><Icon className="w-5 h-5" /></span>
          <div className="font-bold tracking-tight">{card.title}</div>
        </div>
        <p className="text-xs text-muted leading-snug">{card.body}</p>
      </div>
    );
  }

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
      toast('saved.');
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
      onDisconnect?.();
      toast('disconnected.');
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
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-wood shrink-0"><Icon className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight">{card.title}</div>
          <div className="text-xs text-muted leading-snug">{card.subtitle}</div>
        </div>
      </div>
      <div className="space-y-3">
        {card.twitter ? (
          <>
            <Link
              to="/extension-pair"
              className="block w-full text-center bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 transition-colors"
            >
              connect with browser extension (recommended)
            </Link>
            <p className="text-xs text-muted/70 leading-snug">
              new here? clicking will walk you through getting the extension.
            </p>
            <p className="text-xs text-muted leading-snug">
              the tsundoku extension keeps your x cookies fresh automatically — no devtools, no expiry surprises.
            </p>
            {pairings?.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 border border-wood bg-wood/10 text-ink px-2 py-1">
                  connected via {truncateName(pairings[0].name)}
                </span>
                <button
                  type="button"
                  onClick={() => onRevokePairing?.(pairings[0].id)}
                  className="text-muted hover:text-wood underline"
                >
                  disconnect
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowManual(m => !m)}
              className="text-wood text-xs hover:underline"
            >
              {showManual ? 'hide manual entry' : 'or paste cookies manually'}
            </button>
            {showManual && (
              <>
                {guideEl}
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
              </>
            )}
          </>
        ) : (
          <>
            {guideEl}
            <div className="flex gap-2">
              <input
                type="password" autoComplete="off" placeholder={card.placeholder}
                value={fields.value || ''}
                onChange={e => setFields(f => ({ ...f, value: e.target.value }))}
                className="flex-1 min-w-0 bg-bg border border-border px-3 py-2 text-ink text-sm font-mono"
              />
              {SaveBtn}
            </div>
          </>
        )}
        {error && <div className="text-xs text-wood">{error}</div>}
        {updateMode && onDisconnect && (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="text-xs text-muted hover:text-wood underline disabled:opacity-50"
          >
            disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectedChip({ card, active, onSelect, onDisconnected }) {
  const Icon = card.Icon;
  const [busy, setBusy] = useState(false);

  const disconnect = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await api.deleteCredential(card.kind);
      onDisconnected();
      toast('disconnected.');
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors ${
        active ? 'border-wood bg-wood/10' : 'border-border bg-bg hover:border-ink'
      }`}
    >
      <Icon className="w-4 h-4 text-wood" />
      <span className="font-bold tracking-tight">{card.title}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={disconnect}
        onKeyDown={e => { if (e.key === 'Enter') disconnect(e); }}
        className="text-[10px] text-muted hover:text-wood underline ml-1"
      >
        {busy ? '…' : 'disconnect'}
      </span>
    </button>
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
