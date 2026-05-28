import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PlusIcon, TrashIcon } from '../components/Icons.jsx';

// User-facing source types. RSS discovery happens automatically under
// "Website / blog", so we don't expose a raw "RSS feed" option.
const TYPES = [
  { value: 'website',    label: 'Website / blog', hint: 'Paste the homepage URL (e.g. https://stratechery.com). We’ll auto-find its RSS feed.' },
  { value: 'twitter',    label: 'Twitter / X',    hint: 'Handle only, no @ (e.g. FabrizioRomano)' },
  { value: 'youtube',    label: 'YouTube',        hint: 'Channel @handle (e.g. @YannicKilcher) or channel ID starting with UC…' },
  { value: 'newsletter', label: 'Newsletter',     hint: 'The sender’s email address (e.g. newsletter@stratechery.com)' },
];

export default function Sources() {
  const [domains, setDomains] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ type: 'website', identifier: '', display_name: '', domain_slug: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);

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
      <Link to="/settings" className="text-sm text-muted hover:text-ink">← Settings</Link>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight mb-6">Sources</h1>

      {loadError && (
        <div className="mb-6 text-sm text-wood bg-wood/10 border border-wood/30 rounded-md px-3 py-2">
          Couldn’t load: {loadError}
        </div>
      )}

      <form onSubmit={save} className="card bg-elev border border-border rounded-xl p-5 mb-8">
        <h2 className="font-bold mb-3 flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Add a source</h2>
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
            <div className="text-muted text-xs uppercase tracking-wider mb-1">Domain</div>
            <select
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-ink"
              value={form.domain_slug}
              onChange={e => setForm({ ...form, domain_slug: e.target.value })}
              required
            >
              {domains.length === 0 ? (
                <option value="">Loading domains…</option>
              ) : (
                <>
                  {!form.domain_slug && <option value="" disabled>Select a domain</option>}
                  {domains.map(d => <option key={d.id} value={d.slug}>{d.name}</option>)}
                </>
              )}
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
          <button disabled={saving} className="bg-wood text-bg font-bold rounded-md px-4 py-2 hover:bg-wood-2 disabled:opacity-50">
            {saving ? (form.type === 'website' ? 'Finding feed…' : 'Adding…') : 'Add source'}
          </button>
          {notice && (
            <div className={`text-sm ${notice.kind === 'warn' ? 'text-wood' : 'text-muted'}`}>
              {notice.text}
            </div>
          )}
        </div>
      </form>

      <div className="space-y-6">
        {grouped.map(d => (
          <div key={d.id}>
            <h3 className="font-bold text-sm uppercase tracking-wider text-wood mb-2">{d.name}</h3>
            {d.sources.length === 0 ? (
              <div className="text-sm text-muted italic">No sources yet.</div>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-elev">
                {d.sources.map(s => (
                  <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-xs font-bold text-wood uppercase tracking-wider w-20 shrink-0">{s.type}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.display_name || s.identifier}</div>
                      <div className="text-xs text-muted truncate">{s.identifier}</div>
                    </div>
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
    </div>
  );
}
