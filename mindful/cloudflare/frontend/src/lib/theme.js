// Tiny theme manager. Persists choice in localStorage; respects system preference
// by default. Toggling adds/removes the .dark class on <html>.

const KEY = 'mindful.theme';

export function currentTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const t = theme || currentTheme();
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(KEY, t);
  // Update the iOS status-bar tint.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#1A1614' : '#F5F3EE');
}

export function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
