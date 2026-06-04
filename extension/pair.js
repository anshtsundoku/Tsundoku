// Content script — runs only on https://tsundoku-e0v.pages.dev/extension-pair*.
//
// Bridges the web page and the extension background. The page mints a pairing
// token (server-side) and postMessages it here; we hand it to the background
// for storage, then tell the page the extension is installed and listening.

const TSUNDOKU_ORIGIN = 'https://tsundoku-e0v.pages.dev';

window.addEventListener('message', (event) => {
  // Only trust messages from the Tsundoku page itself.
  if (event.origin !== TSUNDOKU_ORIGIN) return;
  const data = event.data;
  if (!data || data.source !== 'tsundoku-pair' || !data.token) return;

  chrome.runtime.sendMessage(
    { type: 'STORE_TOKEN', token: data.token, userEmail: data.userEmail },
    () => {
      // Let the page render its "connected" state.
      window.postMessage({ source: 'tsundoku-ext-installed', ok: true }, TSUNDOKU_ORIGIN);
    },
  );
});
