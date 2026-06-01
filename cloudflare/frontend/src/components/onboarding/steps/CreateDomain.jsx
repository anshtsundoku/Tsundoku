import { useState } from 'react';
import { api } from '../../../lib/api.js';
import { DomainIcon } from '../../Icons.jsx';
import IconPicker from '../../IconPicker.jsx';
import StepShell from '../StepShell.jsx';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function humanize(err) {
  const m = String(err?.message || '');
  const json = m.match(/\{[\s\S]*\}$/);
  if (json) {
    try { return JSON.parse(json[0]).error || m; } catch { /* fall through */ }
  }
  return m || 'something went wrong';
}

export default function CreateDomain({ stepNum, showBack, onBack, onSuccess }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('newspaper');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canCreate = Boolean(name.trim() && icon);

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      await api.createDomain({ name: name.trim(), slug: slugify(name), icon });
      onSuccess();
    } catch (err) {
      setError(humanize(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      stepNum={stepNum}
      showBack={showBack}
      onBack={onBack}
      title="first, a domain."
      body="domains are buckets. tech, geopolitics, personal — pick a name and an icon."
      primaryAction={
        <button
          type="button"
          onClick={create}
          disabled={!canCreate || saving}
          className="w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-50 transition-colors"
        >
          {saving ? 'creating…' : 'create domain'}
        </button>
      }
    >
      <label className="block text-sm">
        <div className="text-muted text-xs uppercase tracking-wider mb-1">name</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="tech, sport, world…"
          className="w-full bg-bg border border-border px-3 py-2 text-ink"
        />
      </label>
      <div className="mt-4 text-sm">
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
      {error && <p className="mt-3 text-sm text-wood">{error}</p>}
      {pickerOpen && (
        <IconPicker value={icon} onChange={setIcon} onClose={() => setPickerOpen(false)} />
      )}
    </StepShell>
  );
}
