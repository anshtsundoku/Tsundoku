// Helpers for reading per-user encrypted third-party credentials.
//
// Credentials live in encrypted columns on `users` (see migration 0009) and
// are written by routes/credentials.js. Cron handlers decrypt them per user.

import { decrypt } from './crypto.js';

// Decrypt an encrypted blob, returning null for empty/missing values and on any
// decryption error (so a single corrupt row never crashes a cron loop).
export async function decryptOrNull(env, blob) {
  if (!blob) return null;
  if (!env.ENCRYPTION_KEY) {
    console.warn('[creds] ENCRYPTION_KEY not configured; cannot decrypt');
    return null;
  }
  try {
    return await decrypt(blob, env.ENCRYPTION_KEY);
  } catch (e) {
    console.warn('[creds] decrypt failed:', e.message);
    return null;
  }
}
