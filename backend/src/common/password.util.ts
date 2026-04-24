/**
 * Password-hashing utility.
 *
 * Uses argon2id, the OWASP 2024 Password Storage Cheat-Sheet recommended
 * algorithm. Parameters pin memory cost (m) and time cost (t) to OWASP
 * minimum profile for interactive login ("m=19456, t=2, p=1").
 *
 * Implementation note: the `@node-rs/argon2` binding is a pure-Rust N-API
 * implementation with prebuilt binaries, so it installs without a C toolchain
 * (unlike the node-gyp-based `argon2` package). That keeps our Alpine
 * Docker image lean and avoids a runtime `make` dependency.
 *
 * Legacy `bcrypt` hashes (starting with `$2a$`, `$2b$`, `$2y$`) are still
 * accepted at verification time so existing databases keep working; on
 * successful verification the caller is expected to re-hash with argon2id.
 */

import { argon2id, verify as argon2Verify, hash as argon2Hash } from '@node-rs/argon2';

/** OWASP 2024 minimum interactive-login profile. */
const ARGON2_PARAMS = {
  algorithm: argon2id,
  memoryCost: 19_456, // KiB — ~19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_PARAMS);
}

export async function verifyPassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  if (!password || !hashed) return false;
  if (hashed.startsWith('$argon2')) {
    try {
      return await argon2Verify(hashed, password);
    } catch {
      return false;
    }
  }
  // Legacy bcrypt path kept for zero-downtime migration. The caller should
  // re-hash on successful verification. Implemented with a constant-time
  // equality check on a locally-computed bcrypt hash only if `bcrypt` is
  // installed — otherwise refuse and force reset.
  try {
    // Lazy-require so bcrypt remains an optional dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcrypt');
    return bcrypt.compare(password, hashed);
  } catch {
    return false;
  }
}

export function isLegacyBcryptHash(hashed: string | null | undefined): boolean {
  if (!hashed) return false;
  return /^\$2[aby]\$/.test(hashed);
}
