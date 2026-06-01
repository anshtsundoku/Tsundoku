// Minimal HS256 JWT sign/verify on Web Crypto (no npm deps).
//
// Used for the "session" cookie issued after Google login. The signing secret
// is env.JWT_SECRET.
//
// NOTE on signatures: Cloudflare Workers have no module-global `env`, so the
// secret must be supplied by the caller. We therefore pass it as the final
// argument — sign(payload, expiresInSeconds, secret) / verify(token, secret) —
// where `secret` is env.JWT_SECRET. The default expiry is 30 days.

const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(str) {
  return b64urlFromBytes(encoder.encode(str));
}

function bytesFromB64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function stringFromB64url(s) {
  return decoder.decode(bytesFromB64url(s));
}

async function hmacKey(secret) {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function sign(payload, expiresInSeconds = DEFAULT_EXPIRY_SECONDS, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + (expiresInSeconds || DEFAULT_EXPIRY_SECONDS) };
  const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(body))}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
  return `${signingInput}.${b64urlFromBytes(sig)}`;
}

export async function verify(token, secret) {
  try {
    if (!token || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, bytesFromB64url(parts[2]), encoder.encode(signingInput));
    if (!ok) return null;
    const payload = JSON.parse(stringFromB64url(parts[1]));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
