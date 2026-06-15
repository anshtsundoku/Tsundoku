// Interface-style management — three distinct visual skins the user can
// switch between in Settings:
//
//   wood     — the original warm walnut + cream look
//   swiss    — International Typographic Style (sharp grid, grotesque, red)
//   bohemian — eclectic warm serif look with organic curves + soft shadows
//
// Mirrors theme.js: a localStorage copy gives an instant, flash-free render on
// load (paired with the inline bootstrap script in index.html), plus a
// best-effort background sync to the server so the choice follows the user
// across devices (silently ignored if the backend doesn't persist it).

import { api } from './api.js';

const KEY = 'tsundoku.uiStyle';
export const UI_STYLES = ['wood', 'swiss', 'bohemian'];
// Wood (warm walnut + cream) is the default skin for new users.
const DEFAULT_STYLE = 'wood';

export function currentUiStyle() {
  const saved = localStorage.getItem(KEY);
  return UI_STYLES.includes(saved) ? saved : DEFAULT_STYLE;
}

export function applyUiStyle(style) {
  const s = UI_STYLES.includes(style) ? style : currentUiStyle();
  const root = document.documentElement;
  root.classList.remove('ui-wood', 'ui-swiss', 'ui-bohemian');
  root.classList.add(`ui-${s}`);
  localStorage.setItem(KEY, s);
  refreshThemeColor();
}

// Keep the iOS status-bar / PWA chrome colour in step with the active skin by
// reading the computed --bg, so we never hardcode per-style hex values.
export function refreshThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const rgb = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg').trim();
  if (rgb) meta.setAttribute('content', `rgb(${rgb.split(/\s+/).join(', ')})`);
}

export async function syncUiStyleFromServer() {
  try {
    const prefs = await api.getPrefs();
    const s = prefs?.ui_style;
    if (UI_STYLES.includes(s) && s !== currentUiStyle()) applyUiStyle(s);
  } catch (e) {
    console.warn('[uiStyle] failed to sync from server', e.message);
  }
}

export async function setUiStyle(style) {
  applyUiStyle(style);
  try { await api.patchPrefs({ ui_style: style }); }
  catch (e) { console.warn('[uiStyle] failed to sync to server', e.message); }
}
