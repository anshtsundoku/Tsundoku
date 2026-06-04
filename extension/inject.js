// Runs in the PAGE's main world (injected by pair.js). Content scripts live in
// an isolated world, so we can't set a page-visible global from there directly.
// The /extension-pair walkthrough polls for this global to detect that the
// extension is installed and active.
window.__tsundokuExt = { version: '0.1.0' };
