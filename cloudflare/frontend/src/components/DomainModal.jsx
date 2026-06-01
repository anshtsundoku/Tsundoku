import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { DomainIcon, XIcon } from './Icons.jsx';
import IconPicker from './IconPicker.jsx';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pull a friendly message out of the api client's thrown Error, which looks
// like "409 Conflict: {"error":"…"}".
function humanize(err) {
  const m = String(err?.message || '');
  const json = m.match(/\{[\s\S]*\}$/);
  if (json) {
    try { return JSON.parse(json[0]).error || m; } catch { /* fall through */ }
  }
  return m || 'something went wrong';
}

// Props: { domain?, onClose, onSaved }
//   domain — pass an existing domain to edit; omit/null to create.
//   onSaved(domain) — called with the created/updated domain on success.
export default function DomainModal({ domain, onClose, onSaved }) {
  const editing = Boolean(domain?.id);
  const [name, setName] = useState(domain?.name || '');
  const [slug, setSlug] = useState(domain?.slug || '');
  const [icon, setIcon] = useState(domain?.icon || 'newspaper');
  const [slugTouched, setSlugTouched] = useState(editing);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !pickerOpen) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerOpen]);

  const onNameChange = (v) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const save = async (e) => {
    e.preventDefault();
    const finalName = name.trim();
    const finalSlug = (slug || slugify(name)).trim();
    if (!finalName || !finalSlug) {
      setError('a name and slug are both needed');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: finalName, slug: finalSlug, icon };
      const result = editing
        ? await api.updateDomain(domain.id, payload)
        : await api.createDomain(payload);
      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(humanize(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <form
        onSubmit={save}
        className="surface bg-bg border border-border w-full max-w-md flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="tt-title text-lg font-bold tracking-tight">
            {editing ? 'edit domain' : 'new domain'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block text-sm">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">name</div>
            <input
              autoFocus
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="tech, sport, world…"
              className="w-full bg-bg border border-border px-3 py-2 text-ink"
            />
          </label>

          <label className="block text-sm">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">slug</div>
            <input
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              placeholder="auto-generated from name"
              className="w-full bg-bg border border-border px-3 py-2 text-ink font-mono text-xs"
            />
            <div className="text-xs text-muted mt-1">used in the url — lowercase, no spaces.</div>
          </label>

          <div className="text-sm">
            <div className="text-muted text-xs uppercase tracking-wider mb-1">icon</div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center gap-3 bg-bg border border-border px-3 py-2 text-ink hover:bg-elev transition-colors"
            >
              <span className="text-wood"><DomainIcon name={icon} className="w-6 h-6" /></span>
              <span className="font-mono text-xs text-muted">{icon}</span>
              <span className="ml-auto text-xs text-muted">change</span>
            </button>
          </div>

          {error && <div className="text-sm text-wood">{error}</div>}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-border">
          <button
            type="submit"
            disabled={saving}
            className="bg-wood text-bg font-bold tt-label tracking-eyebrow text-xs px-4 py-2.5 hover:bg-wood-2 disabled:opacity-50 transition-colors"
          >
            {saving ? 'saving…' : editing ? 'save changes' : 'create domain'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold tt-label tracking-eyebrow text-muted hover:text-ink px-3 py-1.5 transition-colors"
          >
            cancel
          </button>
        </div>
      </form>

      {pickerOpen && (
        <IconPicker
          value={icon}
          onChange={setIcon}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
