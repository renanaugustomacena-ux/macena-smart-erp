import * as crypto from 'crypto';

/**
 * Field-level IBAN encryption helper (plan §31.1 Sprint 23 / S23.4;
 * ADR-DA07).
 *
 * AES-256-GCM with the per-deployment master key from
 * `process.env.FIELD_LEVEL_ENC_KEY` (32 bytes base64). Each ciphertext
 * carries its own random 96-bit IV + 128-bit auth tag, encoded as
 * `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`.
 *
 * Production wiring (KMS-backed key rotation) lands in Sprint 35
 * alongside the SOC 2 audit prep. v1 keeps the format stable behind
 * a `v1:` envelope so a future re-key migration can detect the version.
 */

const ENV_KEY = 'FIELD_LEVEL_ENC_KEY';

function loadKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new Error(
      `${ENV_KEY} env var not set — refusing to encrypt IBAN columns at rest.`,
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `${ENV_KEY} must decode to exactly 32 bytes (AES-256). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

export function encryptIban(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptIban(ciphertext: string): string {
  if (!ciphertext.startsWith('v1:')) {
    throw new Error('Unsupported IBAN ciphertext envelope');
  }
  const [, ivB64, tagB64, ctB64] = ciphertext.split(':');
  const key = loadKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

export function maskIban(plaintext: string): string {
  const cleaned = plaintext.replace(/\s+/g, '');
  if (cleaned.length < 8) return cleaned;
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
}

export function validateIban(plaintext: string): boolean {
  const cleaned = plaintext.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned)) return false;
  // Mod-97 check (ISO 13616).
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  let acc = '';
  for (const ch of rearranged) {
    acc += /[A-Z]/.test(ch)
      ? String(ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10)
      : ch;
  }
  // BigInt mod-97 to avoid precision loss on 30+ digit accumulators.
  return BigInt(acc) % 97n === 1n;
}
