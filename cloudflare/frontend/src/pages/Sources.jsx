import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { typeLabel } from '../lib/labels.js';
import { PlusIcon, TrashIcon } from '../components/Icons.jsx';
import DomainModal from '../components/DomainModal.jsx';

// User-facing source types with v1.3 labels. Backend values are unchanged.
// (Gmail label removed from the picker — existing 'gmail' sources still work,
// they just can't be created from this UI.)
const TYPES = [
  { value: 'website',    label: 'Blog',       hint: 'Paste the homepage URL (e.g. https://stratechery.com). We’ll auto-find its RSS feed.' },
  { value: 'twitter',    label: 'X',          hint: 'Handle only, no @ (e.g. FabrizioRomano)' },
  { value: 'youtube',    label: 'YT',         hint: 'Channel @handle (e.g. @YannicKilcher) or channel ID starting with UC…' },
  { value: 'newsletter', label: 'Newsletter', hint: 'The sender’s email address (e.g. newsletter@stratechery.com)' },
  { value: 'podcast',    label: 'Podcast',    hint: 'Paste the podcast RSS feed URL. Most non-Spotify-exclusive shows have one.' },
];

export default function Sources() {
  const [domains, setDomains] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ type: 'website', identifier: '', display_name: '', domain_slug: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);   // source id currently being edited
  const [editForm, setEditForm] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const save = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.domain_slug) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await api.createSource(form);
      if (result?.discovery_warning) {
        setNotice({ kind: 'warn', text: result.discovery_warning });
      } else if (form.type === 'website' && result?.feed_url) {
        setNotice({ kind: 'ok', text: `Found feed: ${result.feed_url}` });
      } else {
        setNotice({ kind: 'ok', text: 'Source added.' });
      }
      setForm({ type: form.type, identifier: '', display_name: '', domain_slug: form.domain_slug });
      await load();
    } catch (err) {
      setNotice({ kind: 'warn', text: err.message });
    } finally {
      setSaving(false);
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
  };

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
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
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
            <div className="text-muted text-xs uppercase tracking-wider mb-1">Identifier</div>
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
                      <div className="font-bold tracking-tight truncate">{s.display_name || s.identifier}</div>
                      <div className="text-xs text-muted truncate">
                        {s.identifier}
                        {!s.active && <span className="ml-2 text-wood">· paused</span>}
                      </div>
                    </div>
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
