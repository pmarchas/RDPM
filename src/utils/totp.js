// ─── Pure-JS TOTP (RFC 6238) — no external dependencies ─────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Generate a random base32 secret (160-bit) */
export function generateSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 20; i += 5) {
    const b = [bytes[i] || 0, bytes[i+1] || 0, bytes[i+2] || 0, bytes[i+3] || 0, bytes[i+4] || 0];
    out += B32[(b[0] >> 3) & 31];
    out += B32[((b[0] << 2) | (b[1] >> 6)) & 31];
    out += B32[(b[1] >> 1) & 31];
    out += B32[((b[1] << 4) | (b[2] >> 4)) & 31];
    out += B32[((b[2] << 1) | (b[3] >> 7)) & 31];
    out += B32[(b[3] >> 2) & 31];
    out += B32[((b[3] << 3) | (b[4] >> 5)) & 31];
    out += B32[b[4] & 31];
  }
  return out; // 32 chars
}

/** Decode a base32 string to Uint8Array */
function b32decode(str) {
  str = str.toUpperCase().replace(/\s/g, '').replace(/=+$/, '');
  const bytes = [];
  let bits = 0, val = 0;
  for (const ch of str) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(bytes);
}

/** Generate 6-digit TOTP code for the current 30-second window */
export async function generateTOTP(secret, period = 30) {
  const key = b32decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);

  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter >>> 0, false);

  const ck = await crypto.subtle.importKey(
    'raw', key.buffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf));

  const off = sig[sig.length - 1] & 0xf;
  const code = (
    ((sig[off]   & 0x7f) << 24) |
    ((sig[off+1] & 0xff) << 16) |
    ((sig[off+2] & 0xff) <<  8) |
    ( sig[off+3] & 0xff)
  ) % 1_000_000;

  return String(code).padStart(6, '0');
}

/** Verify a user-supplied 6-digit code (checks current + ±1 window for clock drift) */
export async function verifyTOTP(secret, token, period = 30) {
  const t = String(token).trim();
  for (const delta of [0, -1, 1]) {
    const counter = Math.floor(Date.now() / 1000 / period) + delta;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setUint32(4, counter >>> 0, false);
    const key = b32decode(secret);
    const ck = await crypto.subtle.importKey(
      'raw', key.buffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf));
    const off = sig[sig.length - 1] & 0xf;
    const code = (
      ((sig[off]   & 0x7f) << 24) |
      ((sig[off+1] & 0xff) << 16) |
      ((sig[off+2] & 0xff) <<  8) |
      ( sig[off+3] & 0xff)
    ) % 1_000_000;
    if (String(code).padStart(6, '0') === t) return true;
  }
  return false;
}

/** Seconds remaining in the current TOTP window */
export function totpSecondsLeft(period = 30) {
  return period - (Math.floor(Date.now() / 1000) % period);
}

/** Build the otpauth:// URI for QR code generation */
export function buildOTPAuthURI(secret, label = 'RDPM', issuer = 'RDPM') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
