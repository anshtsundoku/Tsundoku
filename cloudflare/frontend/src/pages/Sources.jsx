import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { typeLabel } from '../lib/labels.js';
import { useUser } from '../App.jsx';
import { PlusIcon, TrashIcon, BellIcon, BellOffIcon } from '../components/Icons.jsx';
import DomainModal from '../components/DomainModal.jsx';
import { getPushStatus, subscribeToPush } from '../lib/push.js';

// D1 timestamps come back as "YYYY-MM-DD HH:MM:SS" (UTC, no zone); paused_until
// is set client-side as a full ISO string. Normalize both, then render a short
// relative time that works for past ("2h ago") and future ("in 7d").
function parseTs(s) {
  if (!s) return NaN;
  const str = String(s);
  const iso = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
  return new Date(iso).getTime();
}

function relTime(s) {
  const t = parseTs(s);
  if (!Number.isFinite(t)) return 'never';
  const diff = (t - Date.now()) / 1000;   // positive = future
  const abs = Math.abs(diff);
  if (abs < 60) return 'just now';
  const unit = abs < 3600 ? `${Math.floor(abs / 60)}m`
    : abs < 86400 ? `${Math.floor(abs / 3600)}h`
    : `${Math.floor(abs / 86400)}d`;
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

// Per-source health dot colour. 'pending' (and anything unknown) is gray.
function statusColor(status) {
  switch (status) {
    case 'ok':    return '#22c55e';   // green
    case 'idle':  return '#eab308';   // yellow
    case 'error': return '#ef4444';   // red
    default:      return '#9ca3af';   // gray — pending / never polled
  }
}

function isPausedNow(s) {
  const t = parseTs(s?.paused_until);
  return Number.isFinite(t) && t > Date.now();
}

// Shared with the Home.jsx contextual push banner so the two prompts don't
// double-nudge: dismissing either one suppresses the other.
const PUSH_NUDGE_KEY = 'tsundoku.push.nudged';
const BANNER_DISMISSED_KEY = 'tsundoku.push.banner.dismissed';
function wasPushNudged() {
  try {
    return localStorage.getItem(PUSH_NUDGE_KEY) === '1' ||
           localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  } catch { return false; }
}
function markPushNudged() {
  try {
    localStorage.setItem(PUSH_NUDGE_KEY, '1');
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  } catch { /* ignore */ }
}

function isNotifyOn(s) {
  return s.notify_enabled !== 0 && s.notify_enabled !== false;
}

// User-facing source types with v1.3 labels. Backend values are unchanged.
// 'gmail' (Gmail sender) is only selectable once the user has connected Gmail
// in settings — existing 'gmail' sources keep working regardless.
const TYPES = [
  { value: 'website',    label: 'Blog',         hint: 'Paste the homepage URL (e.g. https://stratechery.com). We’ll auto-find its RSS feed.' },
  { value: 'twitter',    label: 'X',            hint: 'Handle only, no @ (e.g. FabrizioRomano)' },
  { value: 'youtube',    label: 'YT',           hint: 'Channel @handle (e.g. @YannicKilcher) or channel ID starting with UC…' },
  { value: 'newsletter', label: 'Newsletter',   hint: 'The sender’s email address (e.g. newsletter@stratechery.com)' },
  { value: 'podcast',    label: 'Podcast',      hint: 'Paste the podcast RSS feed URL. Most non-Spotify-exclusive shows have one.' },
  { value: 'gmail',      label: 'Gmail sender', hint: 'The sender’s email address (e.g. newsletter@stratechery.com)' },
];

export default function Sources() {
  const user = useUser();
  const gmailConnected = Boolean(user?.gmail_email);
  const [domains, setDomains] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ type: 'website', identifier: '', display_name: '', domain_slug: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);   // source id currently being edited
  const [editForm, setEditForm] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notifyToast, setNotifyToast] = useState(null);
  const [pushNudge, setPushNudge] = useState(false);   // one-time "turn on push?" banner
  const [pushNudgeBusy, setPushNudgeBusy] = useState(false);
  const [ingesting, setIngesting] = useState({});      // { [sourceId]: true } while first fetch runs

  const load = async () => {
    try {
      const [ds, ss] = await Promise.all([api.listDomains(), api.listSources()]);
      const dsArr = ds || [];
      setDomains(dsArr);
      setSources(ss || []);
      setForm(f => ({ ...f, domain_slug: f.domain_slug || dsArr[0]?.slug || '' }));
      setLoadError(null);
    } catch (e) {
      console.error('Sources: failed to load', e);
      setLoadError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  // After a source is added, gently offer push if the user hasn't been asked
  // and isn't already subscribed. One-time per device (localStorage).
  const maybePushNudge = async () => {
    if (wasPushNudged()) return;
    try {
      const st = await getPushStatus();
      if (st.supported && st.configured && st.permission !== 'denied' && !st.subscribed) {
        setPushNudge(true);
      }
    } catch { /* ignore */ }
  };

  const acceptPushNudge = async () => {
    setPushNudgeBusy(true);
    try {
      await subscribeToPush();
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message || 'could not turn on push' });
    } finally {
      markPushNudged();
      setPushNudge(false);
      setPushNudgeBusy(false);
    }
  };

  const dismissPushNudge = () => {
    markPushNudged();
    setPushNudge(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.domain_slug) return;
    setSaving(true);
    setNotice(null);
    try {
      // Gmail sources default their display name to the local-part of the
      // sender address (e.g. "newsletter" from newsletter@stratechery.com).
      const payload = (form.type === 'gmail' && !form.display_name.trim())
        ? { ...form, display_name: form.identifier.split('@')[0] }
        : form;
      const result = await api.createSource(payload);
      if (result?.discovery_warning) {
        setNotice({ kind: 'warn', text: result.discovery_warning });
      } else if (form.type === 'website' && result?.feed_url) {
        setNotice({ kind: 'ok', text: `Found feed: ${result.feed_url}` });
      } else {
        setNotice({ kind: 'ok', text: 'Source added.' });
      }
      setForm({ type: form.type, identifier: '', display_name: '', domain_slug: form.domain_slug });
      await load();
      // Kick off a manual first fetch and let its outcome own the final toast
      // (avoids double-toasting "source added.").
      if (result?.id) trackFirstIngest(result.id);
      else toast('source added.');
      maybePushNudge();
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Trigger ingest-now for a freshly added source, then poll /sources every 2s
  // (up to 30s) until its last_status flips away from 'pending'. The status dot
  // shows a spinner overlay while this runs.
  const trackFirstIngest = async (id) => {
    setIngesting(prev => ({ ...prev, [id]: true }));
    const stop = () => setIngesting(prev => { const n = { ...prev }; delete n[id]; return n; });
    try { await api.ingestNow(id); } catch { /* the poll still runs */ }

    const start = Date.now();
    const tick = async () => {
      try {
        const ss = await api.listSources();
        setSources(ss || []);
        const s = (ss || []).find(x => x.id === id);
        if (s && s.last_status && s.last_status !== 'pending') {
          stop();
          if (s.last_status === 'error') {
            toast('source added — first fetch failed. check your credentials.', { kind: 'error' });
          } else {
            toast('source added.');
          }
          return;
        }
      } catch { /* transient — keep polling */ }
      if (Date.now() - start >= 30000) { stop(); return; }
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 2000);
  };

  const togglePause = async (s) => {
    const paused_until = isPausedNow(s)
      ? null
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    setSources(prev => prev.map(x => (x.id === s.id ? { ...x, paused_until } : x)));
    try {
      await api.patchSource(s.id, { paused_until });
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
      await load();
    }
  };

  const startEdit = (s) => {
    setEditing(s.id);
    setEditForm({
      identifier:   s.identifier,
      display_name: s.display_name || '',
      domain_slug:  s.domain_slug,
      active:       Boolean(s.active),
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm(null);
  };

  const saveEdit = async (id) => {
    if (!editForm) return;
    setSaving(true);
    try {
      const result = await api.patchSource(id, editForm);
      if (result?.discovery_warning) {
        setNotice({ kind: 'warn', text: result.discovery_warning });
      } else {
        setNotice({ kind: 'ok', text: 'Source updated.' });
      }
      cancelEdit();
      await load();
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this source?')) return;
    await api.deleteSource(id);
    setSources(prev => prev.filter(s => s.id !== id));
    toast('removed.');
  };

  const toggleNotify = async (s) => {
    const next = !isNotifyOn(s);
    setSources(prev => prev.map(x => (x.id === s.id ? { ...x, notify_enabled: next ? 1 : 0 } : x)));
    try {
      await api.patchSourceNotify(s.id, next);
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
      await load();
    }
  };

  const bulkNotify = async (enabled) => {
    try {
      const { updated } = await api.bulkNotifications(enabled);
      setNotifyToast(
        enabled ? `notifying for ${updated} sources.` : `muted ${updated} sources.`,
      );
      setTimeout(() => setNotifyToast(null), 3500);
      await load();
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
    }
  };

  const totalSources = sources.length;
  const notifyingCount = sources.filter(isNotifyOn).length;
  const notifyHeaderLine = totalSources === 0
    ? ''
    : notifyingCount === totalSources
      ? `all ${totalSources} sources notifying.`
      : `${notifyingCount} of ${totalSources} sources notifying.`;

  const grouped = domains.map(d => ({
    ...d,
    sources: sources.filter(s => s.domain_slug === d.slug),
  }));

  const hint = TYPES.find(t => t.value === form.type)?.hint;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/settings" className="eyebrow text-muted hover:text-ink transition-colors">← Settings</Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight tt-title leading-none mb-6 break-words">Sources</h1>

      {loadError && (
        <div className="mb-6 text-sm text-wood bg-wood/10 border border-wood px-3 py-2">
          Couldn’t load: {loadError}
        </div>
      )}

      {domains.length === 0 ? (
        <div className="card bg-elev border border-border p-5 mb-8">
          <p className="text-sm text-muted mb-3">you need to create a domain before adding sources.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 transition-colors"
          >
            create a domain
          </button>
        </div>
      ) : (
      <form onSubmit={save} className="card bg-elev border border-border p-5 mb-8">
        <h2 className="eyebrow text-wood mb-4 pb-2 border-b border-line flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Add a source</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">Type</div>
            <select
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-ink"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map(t => (
                <option
                  key={t.value}
                  value={t.value}
                  disabled={t.value === 'gmail' && !gmailConnected}
                >
                  {t.label}
                </option>
              ))}
            </select>
            {!gmailConnected && (
              <div className="text-xs text-muted mt-1">
                <Link to="/settings" className="text-wood hover:underline">connect gmail first in settings →</Link>
              </div>
            )}
          </label>
          <label className="text-sm">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">Domain <span className="text-wood">*</span></div>
            <select
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-ink"
              value={form.domain_slug}
              onChange={e => {
                if (e.target.value === '__new__') { setModalOpen(true); return; }
                setForm({ ...form, domain_slug: e.target.value });
              }}
              required
            >
              {!form.domain_slug && <option value="" disabled>Select a domain</option>}
              {domains.map(d => <option key={d.id} value={d.slug}>{d.name}</option>)}
              <option value="__new__">+ new domain</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">{form.type === 'gmail' ? 'sender email' : 'Identifier'}</div>
            <input
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-ink"
              placeholder={hint}
              value={form.identifier}
              onChange={e => setForm({ ...form, identifier: e.target.value })}
              required
            />
            <div className="text-xs text-muted mt-1">{hint}</div>
          </label>
          <label className="text-sm sm:col-span-2">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">Display name (optional)</div>
            <input
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-ink"
              placeholder="What this source is called in your feed"
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button disabled={saving || !form.domain_slug} className="bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 disabled:opacity-50 transition-colors">
            {saving ? (form.type === 'website' ? 'Finding feed…' : 'Adding…') : 'Add source'}
          </button>
          {notice && (
            <div className={`text-sm ${notice.kind === 'warn' ? 'text-wood' : 'text-muted'}`}>
              {notice.text}
            </div>
          )}
        </div>
      </form>
      )}

      {pushNudge && (
        <div className="mb-6 bg-elev border border-wood px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-ink flex-1">want a ping when there's something new?</p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={acceptPushNudge}
              disabled={pushNudgeBusy}
              className="text-xs tt-label tracking-eyebrow font-bold bg-wood text-bg px-3 py-1.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
            >
              {pushNudgeBusy ? '…' : 'yes, turn on'}
            </button>
            <button
              type="button"
              onClick={dismissPushNudge}
              className="text-xs tt-label tracking-eyebrow font-bold text-muted hover:text-ink transition-colors"
            >
              not now
            </button>
          </div>
        </div>
      )}

      {totalSources >= 2 && (
        <div className="flex items-center justify-between gap-3 mb-4 text-sm">
          <span className="text-muted">{notifyHeaderLine}</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => bulkNotify(true)}
              className="text-xs tt-label tracking-eyebrow font-bold text-wood hover:underline"
            >
              notify all
            </button>
            <button
              type="button"
              onClick={() => bulkNotify(false)}
              className="text-xs tt-label tracking-eyebrow font-bold text-muted hover:text-ink hover:underline"
            >
              mute all
            </button>
          </div>
        </div>
      )}
      {notifyToast && (
        <p className="text-xs text-muted mb-4 -mt-2">{notifyToast}</p>
      )}

      <div className="space-y-6">
        {grouped.map(d => (
          <div key={d.id}>
            <h3 className="eyebrow text-wood mb-2 pb-2 border-b border-line">{d.name}</h3>
            {d.sources.length === 0 ? (
              <div className="text-sm text-muted">No sources yet.</div>
            ) : (
              <ul className="divide-y divide-border border border-border overflow-hidden bg-elev">
                {d.sources.map(s => editing === s.id ? (
                  <li key={s.id} className="px-4 py-3">
                    <div className="grid sm:grid-cols-2 gap-2 mb-3">
                      <label className="text-xs">
                        <div className="text-muted uppercase tracking-wider mb-1">Domain</div>
                        <select
                          className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-ink text-sm"
                          value={editForm.domain_slug}
                          onChange={e => setEditForm({ ...editForm, domain_slug: e.target.value })}
                        >
                          {domains.map(dx => <option key={dx.id} value={dx.slug}>{dx.name}</option>)}
                        </select>
                      </label>
                      <label className="text-xs">
                        <div className="text-muted uppercase tracking-wider mb-1">Active</div>
                        <div className="flex items-center h-9">
                          <input
                            type="checkbox"
                            checked={editForm.active}
                            onChange={e => setEditForm({ ...editForm, active: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm text-muted">{editForm.active ? 'On' : 'Paused'}</span>
                        </div>
                      </label>
                      <label className="text-xs sm:col-span-2">
                        <div className="text-muted uppercase tracking-wider mb-1">Identifier</div>
                        <input
                          className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-ink text-sm"
                          value={editForm.identifier}
                          onChange={e => setEditForm({ ...editForm, identifier: e.target.value })}
                        />
                      </label>
                      <label className="text-xs sm:col-span-2">
                        <div className="text-muted uppercase tracking-wider mb-1">Display name</div>
                        <input
                          className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-ink text-sm"
                          value={editForm.display_name}
                          onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(s.id)}
                        disabled={saving}
                        className="bg-wood text-bg text-xs font-bold tt-label tracking-eyebrow px-3 py-1.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="text-xs font-bold tt-label tracking-eyebrow text-muted hover:text-ink px-3 py-1.5 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="eyebrow text-wood w-20 shrink-0">{typeLabel(s.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold tracking-tight flex items-center gap-2">
                        {ingesting[s.id] ? (
                          <span
                            className="inline-block w-3 h-3 rounded-full border-2 border-wood border-t-transparent animate-spin shrink-0"
                            aria-label="fetching"
                          />
                        ) : (
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: statusColor(s.last_status) }}
                            title={`last fetched: ${relTime(s.last_status_at)}`}
                            aria-label={`status: ${s.last_status || 'pending'}`}
                          />
                        )}
                        <span className="truncate">{s.display_name || s.identifier}</span>
                      </div>
                      <div className="text-xs text-muted truncate">
                        {s.identifier}
                        {!s.active && <span className="ml-2 text-wood">· paused</span>}
                      </div>
                      {isPausedNow(s) && (
                        <div className="text-xs text-muted italic">
                          paused · resumes {relTime(s.paused_until)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePause(s)}
                      className={`p-1.5 transition-colors ${isPausedNow(s) ? 'text-wood' : 'text-muted hover:text-ink'}`}
                      title={isPausedNow(s) ? 'resume this source' : 'pause for 7 days'}
                      aria-label={isPausedNow(s) ? 'Resume source' : 'Pause source'}
                    >
                      {isPausedNow(s)
                        ? <PlayCircle className="w-4 h-4" />
                        : <PauseCircle className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleNotify(s)}
                      className={`p-1.5 transition-colors ${isNotifyOn(s) ? 'text-wood' : 'text-muted'}`}
                      title={isNotifyOn(s) ? 'notifications on for this source' : 'muted'}
                      aria-label={isNotifyOn(s) ? 'Mute notifications' : 'Enable notifications'}
                    >
                      {isNotifyOn(s)
                        ? <BellIcon className="w-4 h-4" />
                        : <BellOffIcon className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs font-bold tt-label tracking-eyebrow text-muted hover:text-ink px-2 py-1 transition-colors"
                      aria-label="Edit"
                    >
                      Edit
                    </button>
                    <button onClick={() => remove(s.id)} className="text-muted hover:text-wood" aria-label="Delete">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <DomainModal
          onClose={() => setModalOpen(false)}
          onSaved={(d) => {
            setModalOpen(false);
            if (d?.slug) setForm(f => ({ ...f, domain_slug: d.slug }));
            load();
          }}
        />
      )}
    </div>
  );
}
