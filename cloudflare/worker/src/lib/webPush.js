// Web Push payload encryption + VAPID auth, implemented from scratch on top
// of the Web Crypto API. Self-contained — no npm deps, runs inside Workers.
//
// References:
//   * RFC 8291 (Message Encryption for Web Push, aes128gcm)
//   * RFC 8292 (VAPID, JWT auth)
//
// Usage:
//   await sendWebPush({ subscription, payload, vapid });
//   subscription: { endpoint, keys: { p256dh, auth } } — what the browser
//                 returned from pushManager.subscribe()
//   payload:      string (typically a JSON-encoded notification body)
//   vapid:        { publicKey, privateKey, subject }
//                 publicKey/privateKey are base64url-encoded P-256 keys.

// ────────────────────────────── base64url ─────────────────────────────────
function b64urlEncode(bytes) {
  let s = '';
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const TE = new TextEncoder();
function concat(...arrs) {
  let n = 0; for (const a of arrs) n += a.length;
  const out = new Uint8Array(n);
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

// ────────────────────────────── primitives ────────────────────────────────
async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
// HKDF-Expand for short outputs (≤ 32 bytes — one iteration is enough).
async function hkdfExpand(prk, info, length) {
  const data = concat(info, new Uint8Array([0x01]));
  const t = await hmacSha256(prk, data);
  return t.slice(0, length);
}

// ────────────────────────────── VAPID JWT ─────────────────────────────────
// Parse a base64url-encoded uncompressed P-256 public key (65 bytes, 0x04|x|y)
// into the JWK { x, y } pieces needed by Web Crypto.
function xyFromPublicKey(pubBytes) {
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('VAPID public key must be uncompressed P-256 (65 bytes)');
  }
  return {
    x: b64urlEncode(pubBytes.slice(1, 33)),
    y: b64urlEncode(pubBytes.slice(33, 65)),
  };
}

async function vapidJwt(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud, exp, sub: subject };
  const headerB64  = b64urlEncode(TE.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(TE.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pubBytes = b64urlDecode(publicKey);
  const { x, y } = xyFromPublicKey(pubBytes);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: b64urlEncode(b64urlDecode(privateKey)),
    x, y,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, TE.encode(signingInput)
  ));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// ─────────────────── aes128gcm payload encryption (RFC 8291) ──────────────
async function encryptAes128Gcm(payload, p256dh, auth) {
  const uaPub = b64urlDecode(p256dh);     // 65 bytes
  const authSecret = b64urlDecode(auth);  // 16 bytes

  // Server ephemeral keypair
  const asKp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKp.publicKey));

  // ECDH(server_priv, ua_pub) → shared secret (32 bytes)
  const uaPubKey = await crypto.subtle.importKey(
    'raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPubKey }, asKp.privateKey, 256
  ));

  // Two-stage HKDF per RFC 8291:
  //   PRK_key  = HMAC-SHA256(auth_secret, shared)
  //   key_info = "WebPush: info\0" || ua_pub || as_pub
  //   IKM      = HKDF-Expand(PRK_key, key_info, 32)
  //   PRK      = HMAC-SHA256(salt, IKM)
  //   CEK      = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
  //   NONCE    = HKDF-Expand(PRK, "Content-Encoding: nonce\0",     12)
  const prkKey = await hmacSha256(authSecret, shared);
  const keyInfo = concat(TE.encode('WebPush: info\0'), uaPub, asPubRaw);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prk, TE.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, TE.encode('Content-Encoding: nonce\0'), 12);

  // Plaintext = payload || 0x02 (padding delimiter, no extra padding).
  const plain = concat(TE.encode(payload), new Uint8Array([0x02]));
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, cekKey, plain
  ));

  // Header: salt(16) || rs(4, BE uint32 = 4096) || idlen(1, = 65) || as_pub(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // rs = 4096 → 0x00 0x00 0x10 0x00 (big-endian)
  header[16] = 0; header[17] = 0; header[18] = 0x10; header[19] = 0x00;
  header[20] = 65;
  header.set(asPubRaw, 21);

  return concat(header, ct);
}

// ────────────────────────────── send ─────────────────────────────────────
// Returns { ok, status, expired } — `expired: true` if the push service
// reports the subscription is gone (404/410) so the caller can delete it.
export async function sendWebPush({ subscription, payload, vapid, ttl = 86400 }) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { ok: false, status: 0, error: 'bad subscription' };
  }
  if (!vapid?.publicKey || !vapid?.privateKey || !vapid?.subject) {
    return { ok: false, status: 0, error: 'vapid not configured' };
  }

  const body = await encryptAes128Gcm(payload, subscription.keys.p256dh, subscription.keys.auth);
  const jwt  = await vapidJwt(subscription.endpoint, vapid);

  const headers = new Headers({
    'Content-Encoding': 'aes128gcm',
    'Content-Type':     'application/octet-stream',
    'TTL':              String(ttl),
    'Authorization':    `vapid t=${jwt}, k=${vapid.publicKey}`,
    'Content-Length':   String(body.length),
  });

  const res = await fetch(subscription.endpoint, { method: 'POST', headers, body });
  return {
    ok: res.ok,
    status: res.status,
    expired: res.status === 404 || res.status === 410,
  };
}

// ────────────────────────────── VAPID gen ────────────────────────────────
// Generates a fresh VAPID key pair. Run once during setup, store the
// returned values as Worker secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return {
    publicKey:  b64urlEncode(pubRaw),
    privateKey: privJwk.d,
  };
}
