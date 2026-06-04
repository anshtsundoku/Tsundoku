// Tiny imperative toast bus. No deps, framework-agnostic.
//
//   import { toast } from '../lib/toast.js';
//   toast('saved.');
//   toast('something broke.', { kind: 'error' });
//
// ToastHost (mounted once in App.jsx) subscribes and renders. A global
// window.toast is also exposed so non-React modules (e.g. lib/api.js) can call
// it without importing.

const MAX_VISIBLE = 3;
const TTL = { success: 3500, error: 6000 };

let toasts = [];
const subscribers = new Set();
let nextId = 1;

function emit() {
  for (const fn of subscribers) fn(toasts);
}

export function subscribe(fn) {
  subscribers.add(fn);
  fn(toasts);
  return () => subscribers.delete(fn);
}

export function dismissToast(id) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

export function toast(message, { kind = 'success' } = {}) {
  if (!message) return null;
  const id = nextId++;
  // Keep at most MAX_VISIBLE — older ones drop off the top.
  toasts = [...toasts, { id, message: String(message), kind }].slice(-MAX_VISIBLE);
  emit();
  const ttl = TTL[kind] ?? TTL.success;
  setTimeout(() => dismissToast(id), ttl);
  return id;
}

// Expose globally for non-React callers (api.js). Optional-chained at call site.
if (typeof window !== 'undefined') {
  window.toast = toast;
}
