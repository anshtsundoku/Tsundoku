import { useState } from 'react';
import { api } from '../../../lib/api.js';
import StepShell from '../StepShell.jsx';

const GUIDE_BLOCK = (
  <div
    className="flex items-center justify-center text-center border border-line bg-bg/40 text-muted text-xs px-3 mb-4"
    style={{ minHeight: 80 }}
  >
    Setup guides will come here
  </div>
);

export default function ConnectCredential({
  stepNum,
  showBack,
  onBack,
  onSuccess,
  onSkip,
  title,
  body,
  kind,
  fields,
  connectLabel = 'connect',
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const canConnect = fields.every(f => String(values[f.key] || '').trim());

  const connect = async () => {
    if (!canConnect) return;
    setBusy(true);
    setError(null);
    try {
      const payload = fields.length === 1
        ? values[fields[0].key].trim()
        : { auth_token: values.auth_token?.trim(), ct0: values.ct0?.trim() };
      await api.patchCredential(kind, payload);
      onSuccess();
    } catch (err) {
      setError(err.message || 'could not save');
      setBusy(false);
    }
  };

  return (
    <StepShell
      stepNum={stepNum}
      showBack={showBack}
      onBack={onBack}
      title={title}
      body={body}
      primaryAction={
        <button
          type="button"
          onClick={connect}
          disabled={!canConnect || busy}
          className="w-full bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-50 transition-colors"
        >
          {busy ? 'saving…' : connectLabel}
        </button>
      }
      skipAction={
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-sm text-muted hover:text-ink py-1 transition-colors"
        >
          skip for now
        </button>
      }
    >
      {GUIDE_BLOCK}
      <div className="space-y-2">
        {fields.map(f => (
          <input
            key={f.key}
            type="password"
            autoComplete="off"
            placeholder={f.placeholder}
            value={values[f.key] || ''}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            className="w-full bg-bg border border-border px-3 py-2 text-ink text-sm font-mono"
          />
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-wood">{error}</p>}
    </StepShell>
  );
}
