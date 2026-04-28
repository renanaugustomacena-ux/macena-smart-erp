import {
  hashPassword,
  isLegacyBcryptHash,
  verifyPassword,
} from './password.util';

describe('password util', () => {
  describe('isLegacyBcryptHash', () => {
    it('detects legacy bcrypt hashes', () => {
      expect(isLegacyBcryptHash('$2a$10$abcdefghij')).toBe(true);
      expect(isLegacyBcryptHash('$2b$12$abc')).toBe(true);
      expect(isLegacyBcryptHash('$2y$12$abc')).toBe(true);
    });

    it('rejects argon2 / empty / random strings as bcrypt', () => {
      expect(isLegacyBcryptHash('$argon2id$v=19$m=19456,t=2,p=1$abc$def')).toBe(
        false,
      );
      expect(isLegacyBcryptHash('')).toBe(false);
      expect(isLegacyBcryptHash(null)).toBe(false);
      expect(isLegacyBcryptHash(undefined)).toBe(false);
      expect(isLegacyBcryptHash('plain-text')).toBe(false);
    });
  });

  describe('hashPassword + verifyPassword (real Argon2id round-trip)', () => {
    it('produces an Argon2id-encoded hash', async () => {
      const hash = await hashPassword('correct-horse-battery-staple-42');
      // PHC string format: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    });

    it('verifies a freshly-hashed password as true', async () => {
      const hash = await hashPassword('correct-horse-battery-staple-42');
      await expect(
        verifyPassword('correct-horse-battery-staple-42', hash),
      ).resolves.toBe(true);
    });

    it('rejects a wrong password against the same hash', async () => {
      const hash = await hashPassword('correct-horse-battery-staple-42');
      await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    });

    it('returns false for empty inputs', async () => {
      const hash = await hashPassword('something');
      await expect(verifyPassword('', hash)).resolves.toBe(false);
      await expect(verifyPassword('something', '')).resolves.toBe(false);
    });

    it('returns false for malformed argon2 hash', async () => {
      await expect(
        verifyPassword('something', '$argon2id$invalid'),
      ).resolves.toBe(false);
    });

    it('hash is salted: the same password produces different hashes', async () => {
      const a = await hashPassword('same-password');
      const b = await hashPassword('same-password');
      expect(a).not.toBe(b);
      await expect(verifyPassword('same-password', a)).resolves.toBe(true);
      await expect(verifyPassword('same-password', b)).resolves.toBe(true);
    });
  });
});
