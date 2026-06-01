// Client-side auth helpers. Thin wrappers over the API that also manage the
// locally-stored bearer token (see lib/api.js).

import { api, setToken, clearToken } from './api.js';

// Resolve the signed-in user, or null. Never throws (a 401 with no token just
// means "not signed in").
export async function me() {
  try {
    const { user } = await api.me();
    return user || null;
  } catch {
    return null;
  }
}

// Log out: best-effort server cookie clear, then drop the local token.
export async function logout() {
  try { await api.logout(); } catch { /* clear locally regardless */ }
  clearToken();
}

// Exchange a Google ID token for a session, persist the bearer token, and land
// back on the home route (full reload so App re-runs the auth gate).
export async function signInWithGoogle(credential) {
  const { token } = await api.googleAuth(credential);
  if (token) setToken(token);
  window.location.assign('/');
}
