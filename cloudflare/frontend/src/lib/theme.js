// Theme management — light/dark.
//
// Strategy: keep a localStorage copy for instant render on app load (no flash
// of wrong theme), but sync with the server in the background so the choice
// follows you between devices.

import { api } from './api.js';
import { refreshThemeColor } from './uiStyle.js';

const KEY = 'tsundoku.theme';

export function currentTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const t = theme || currentTheme();
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(KEY, t);
  // Chrome colour follows the active skin's computed --bg (handles all three
  // interface styles in both light and dark).
  refreshThemeColor();
}

// Background fetch: if the server has a theme different from local, switch.
// Called once on app start.
export async function syncThemeFromServer() {
  try {
    const prefs = await api.getPrefs();
    if (prefs?.theme && (prefs.theme === 'light' || prefs.theme === 'dark')) {
      if (prefs.theme !== currentTheme()) applyTheme(prefs.theme);
    }
  } catch (e) {
    console.warn('[theme] failed to sync from server', e.message);
  }
}

// Toggling theme: apply locally for instant UX, then push to server so other
// devices pick it up on their next poll/load.
export async function setTheme(theme) {
  applyTheme(theme);
  try { await api.patchPrefs({ theme }); }
  catch (e) { console.warn('[theme] failed to sync to server', e.message); }
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
