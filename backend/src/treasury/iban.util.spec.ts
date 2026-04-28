import * as crypto from 'crypto';
import {
  decryptIban,
  encryptIban,
  maskIban,
  validateIban,
} from './iban.util';

const KEY = crypto.randomBytes(32).toString('base64');

describe('IBAN field-level encryption (S23.4 / ADR-DA07)', () => {
  let saved: string | undefined;
  beforeAll(() => {
    saved = process.env.FIELD_LEVEL_ENC_KEY;
    process.env.FIELD_LEVEL_ENC_KEY = KEY;
  });
  afterAll(() => {
    process.env.FIELD_LEVEL_ENC_KEY = saved;
  });

  it('round-trips a plaintext IBAN', () => {
    const iban = 'IT60X0542811101000000123456';
    const ct = encryptIban(iban);
    expect(ct.startsWith('v1:')).toBe(true);
    expect(decryptIban(ct)).toBe(iban);
  });

  it('produces unique ciphertexts for the same plaintext (random IV)', () => {
    const iban = 'IT60X0542811101000000123456';
    const a = encryptIban(iban);
    const b = encryptIban(iban);
    expect(a).not.toBe(b);
    expect(decryptIban(a)).toBe(decryptIban(b));
  });

  it('mask-iban surfaces only first 4 + last 4', () => {
    expect(maskIban('IT60 X054 2811 1010 0000 0123 456')).toBe('IT60****3456');
  });

  it('validateIban accepts a real Italian IBAN and rejects garbage', () => {
    expect(validateIban('IT60X0542811101000000123456')).toBe(true);
    expect(validateIban('IT60X0542811101000000123455')).toBe(false);
    expect(validateIban('not-an-iban')).toBe(false);
  });

  it('refuses to encrypt without FIELD_LEVEL_ENC_KEY', () => {
    const previous = process.env.FIELD_LEVEL_ENC_KEY;
    delete process.env.FIELD_LEVEL_ENC_KEY;
    try {
      expect(() => encryptIban('IT60X0542811101000000123456')).toThrow(
        /FIELD_LEVEL_ENC_KEY/,
      );
    } finally {
      process.env.FIELD_LEVEL_ENC_KEY = previous;
    }
  });
});
