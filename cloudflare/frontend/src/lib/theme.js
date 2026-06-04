// Theme management — light / dark / auto.
//
// Strategy: keep a localStorage copy for instant render on app load (no flash
// of wrong theme), but sync with the server in the background so the choice
// follows you between devices. 'auto' follows the OS colour scheme live.

import { api } from './api.js';
import { refreshThemeColor } from './uiStyle.js';

const KEY = 'tsundoku.theme';
const VALUES = ['light', 'dark', 'auto'];

// Live listener bookkeeping for the 'auto' mode.
let mql = null;
let mqlHandler = null;

function systemPrefersDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
  catch { return false; }
}

// The stored preference: 'light' | 'dark' | 'auto'. First-time users (no stored
// value) default to 'auto'; an existing choice is never overridden.
export function currentTheme() {
  const saved = localStorage.getItem(KEY);
  return VALUES.includes(saved) ? saved : 'auto';
}

// Resolve a preference to the concrete skin actually applied to the document.
function resolveTheme(pref) {
  return pref === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

function applyResolved(resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  // Chrome colour follows the active skin's computed --bg (handles all three
  // interface styles in both light and dark).
  refreshThemeColor();
}

// Attach/detach the OS colour-scheme listener depending on whether we're in
// 'auto'. While in auto, OS changes re-apply the resolved theme immediately.
function ensureAutoListener(pref) {
  if (pref === 'auto') {
    if (!mql) {
      try { mql = window.matchMedia('(prefers-color-scheme: dark)'); } catch { mql = null; }
    }
    if (mql && !mqlHandler) {
      mqlHandler = () => { if (currentTheme() === 'auto') applyResolved(resolveTheme('auto')); };
      try { mql.addEventListener('change', mqlHandler); }
      catch { mql.addListener?.(mqlHandler); }   // older Safari
    }
  } else if (mql && mqlHandler) {
    try { mql.removeEventListener('change', mqlHandler); }
    catch { mql.removeListener?.(mqlHandler); }
    mqlHandler = null;
  }
}

export function applyTheme(theme) {
  const pref = VALUES.includes(theme) ? theme : currentTheme();
  applyResolved(resolveTheme(pref));
  localStorage.setItem(KEY, pref);
  ensureAutoListener(pref);
}

// Background fetch: if the server has a theme different from local, switch.
// Called once on app start.
export async function syncThemeFromServer() {
  try {
    const prefs = await api.getPrefs();
    if (prefs?.theme && VALUES.includes(prefs.theme)) {
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
