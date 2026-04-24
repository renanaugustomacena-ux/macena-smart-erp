import { isLegacyBcryptHash } from './password.util';

describe('password util', () => {
  it('detects legacy bcrypt hashes', () => {
    expect(isLegacyBcryptHash('$2a$10$abcdefghij')).toBe(true);
    expect(isLegacyBcryptHash('$2b$12$abc')).toBe(true);
    expect(isLegacyBcryptHash('$2y$12$abc')).toBe(true);
  });

  it('rejects argon2 / empty / random strings as bcrypt', () => {
    expect(isLegacyBcryptHash('$argon2id$v=19$m=19456,t=2,p=1$abc$def')).toBe(false);
    expect(isLegacyBcryptHash('')).toBe(false);
    expect(isLegacyBcryptHash(null)).toBe(false);
    expect(isLegacyBcryptHash(undefined)).toBe(false);
    expect(isLegacyBcryptHash('plain-text')).toBe(false);
  });
});
