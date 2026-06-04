import { useEffect, useState } from 'react';
import { subscribe, dismissToast } from '../lib/toast.js';

// Renders the ephemeral toast stack bottom-right, above the safe-area inset.
// Mounted once at the App root.
export default function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribe(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed right-4 z-50 flex flex-col items-end gap-2 pointer-events-none"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`toast-fade-in pointer-events-auto text-left w-[280px] max-w-[calc(100vw-2rem)] bg-elev border rounded-lg shadow-soft py-2.5 px-4 text-sm text-ink ${
            t.kind === 'error' ? 'border-wood' : 'border-border'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
