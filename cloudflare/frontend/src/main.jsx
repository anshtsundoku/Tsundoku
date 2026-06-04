import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './styles/index.css';

// Register the service worker and surface updates via a toast instead of a
// silent auto-reload. UpdateToast listens for the event; window.__tsundokuUpdate
// applies the waiting SW and reloads.
const updateSW = registerSW({
  onNeedRefresh() { window.dispatchEvent(new CustomEvent('tsundoku:update-available')); },
  onOfflineReady() {},
  immediate: true,
});
window.__tsundokuUpdate = () => updateSW(true);

// Poll for a new deploy every 5 minutes while the app is open.
setInterval(() => {
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.update()));
}, 5 * 60 * 1000);

// And on app-resume (covers the PWA returning to foreground).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.update()));
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
