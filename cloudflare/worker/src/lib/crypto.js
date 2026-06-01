// Authenticated encryption for per-user third-party credentials.
//
// Web Crypto only (no npm deps). An AES-GCM 256-bit key is derived from
// env.ENCRYPTION_KEY (a 32-byte / 64-hex-char string) via HKDF-SHA256. Each
// ciphertext is returned as base64( iv(12 bytes) || ciphertext+tag ), so the
// random IV travels with the blob and never repeats across encryptions.
//
//   const blob = await encrypt(apiKey, env.ENCRYPTION_KEY);   // → base64 string
//   const key  = await decrypt(blob,  env.ENCRYPTION_KEY);    // → plaintext

const IV_BYTES = 12;                       // AES-GCM standard nonce length
const HKDF_INFO = 'tsundoku-cred-v1';      // domain-separation label

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function hexToBytes(hex) {
  const clean = String(hex || '').trim().toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error('ENCRYPTION_KEY must be a hex string');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Derive a non-extractable AES-GCM key from the hex key material via HKDF.
async function deriveKey(keyMaterial) {
  const keyBytes = hexToBytes(keyMaterial);
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  const base = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(HKDF_INFO) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext, keyMaterial) {
  const key = await deriveKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(plaintext))),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);
  return bytesToBase64(blob);
}

export async function decrypt(b64, keyMaterial) {
  const key = await deriveKey(keyMaterial);
  const blob = base64ToBytes(b64);
  if (blob.length <= IV_BYTES) throw new Error('ciphertext too short');
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return decoder.decode(pt);
}
