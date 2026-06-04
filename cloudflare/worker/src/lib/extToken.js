// Browser-extension pairing tokens.
//
// A pairing token is a long-lived bearer the extension stores and sends on
// every call. We persist only its sha256 hash (extension_pairings.token_hash),
// never the plaintext — so a database leak can't be replayed against the API.
//
//   const plain = generateToken();              // hand to the extension once
//   await insert ... hashToken(plain) ...       // store the hash
//   const who = await verifyToken(env, plain);  // { user_id, pairing_id } | null

import { first, run } from './db.js';

// 32 bytes of CSPRNG randomness, base64url-encoded (no padding).
export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// sha256(plain) as lowercase hex.
export async function hashToken(plain) {
  const data = new TextEncoder().encode(String(plain));
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

// Resolve a plaintext bearer to its pairing. Returns { user_id, pairing_id } on
// a hit (and stamps last_used_at), or null when the token is unknown/revoked.
export async function verifyToken(env, plainToken) {
  if (!plainToken) return null;
  const hash = await hashToken(plainToken);
  const row = await first(env,
    `SELECT id, user_id FROM extension_pairings WHERE token_hash = ?`, [hash]);
  if (!row) return null;
  await run(env,
    `UPDATE extension_pairings SET last_used_at = datetime('now') WHERE id = ?`, [row.id]);
  return { user_id: row.user_id, pairing_id: row.id };
}
