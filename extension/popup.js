// Popup UI. Asks the background for status and renders one of three states.

const SETTINGS_URL = 'https://tsundoku-e0v.pages.dev/settings';
const statusEl = document.getElementById('status');

function relativeTime(ms) {
  if (!ms) return 'never';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function openSettings() {
  chrome.tabs.create({ url: SETTINGS_URL });
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) {
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

function renderNotConnected() {
  statusEl.replaceChildren(
    el('h2', {}, 'not connected'),
    el('p', { className: 'muted' },
      'open tsundoku in this browser, go to settings, and pair this extension.'),
    el('div', { className: 'btn-row' }, [
      el('button', { className: 'primary', onclick: openSettings }, 'open tsundoku'),
    ]),
  );
}

function renderPaired(status) {
  const syncBtn = el('button', { className: 'primary' }, 'sync now');
  const disconnectBtn = el('button', {}, 'disconnect');

  syncBtn.onclick = async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = 'syncing…';
    const r = await sendMessage({ type: 'SYNC_NOW' });
    if (!r?.ok && r?.status === 401) return load();
    syncBtn.disabled = false;
    syncBtn.textContent = 'sync now';
    if (!r?.ok && r?.error) {
      statusEl.querySelector('.note')?.replaceChildren(document.createTextNode(r.error));
    } else {
      load();
    }
  };
  disconnectBtn.onclick = async () => {
    await sendMessage({ type: 'DISCONNECT' });
    load();
  };

  statusEl.replaceChildren(
    el('h2', {}, 'connected'),
    el('p', { className: 'muted' }, [
      'connected as ',
      el('span', { className: 'email' }, status.userEmail || 'your account'),
      `. last sync: ${relativeTime(status.lastSyncedAt)}.`,
    ]),
    el('div', { className: 'btn-row' }, [syncBtn, disconnectBtn]),
    el('p', { className: 'note' }, ''),
  );
}

function renderInvalid() {
  const rePairBtn = el('button', { className: 'primary', onclick: openSettings }, 're-pair');
  statusEl.replaceChildren(
    el('p', { className: 'danger' }, 'pairing expired. re-pair to keep syncing.'),
    el('div', { className: 'btn-row' }, [rePairBtn]),
  );
}

async function load() {
  const status = await sendMessage({ type: 'GET_STATUS' });
  if (!status?.paired) return renderNotConnected();
  if (status.pairingInvalid) return renderInvalid();
  renderPaired(status);
}

load();
