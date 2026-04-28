import { HmacSigner } from './hmac-signer';

describe('HmacSigner (S14.6 — pure logic)', () => {
  const signer = new HmacSigner();

  it('produces a stable sha256= header for fixed inputs', () => {
    const out = signer.sign({
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"hello":"world"}',
      secret: 'shared-secret',
    });
    expect(out).toMatch(/^sha256=[0-9a-f]{64}$/);
    // Determinism — same inputs produce same signature.
    const again = signer.sign({
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"hello":"world"}',
      secret: 'shared-secret',
    });
    expect(again).toBe(out);
  });

  it('verifies its own signature', () => {
    const inputs = {
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"a":1}',
      secret: 's3kr3t',
    };
    const sig = signer.sign(inputs);
    expect(signer.verify(inputs, sig)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const goodSig = signer.sign({
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"a":1}',
      secret: 's3kr3t',
    });
    expect(
      signer.verify(
        {
          timestamp: '2026-04-28T10:00:00Z',
          rawBody: '{"a":2}',
          secret: 's3kr3t',
        },
        goodSig,
      ),
    ).toBe(false);
  });

  it('rejects a wrong-secret signature', () => {
    const sig = signer.sign({
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"a":1}',
      secret: 's3kr3t',
    });
    expect(
      signer.verify(
        {
          timestamp: '2026-04-28T10:00:00Z',
          rawBody: '{"a":1}',
          secret: 'WRONG',
        },
        sig,
      ),
    ).toBe(false);
  });

  it('rejects a different timestamp (replay protection)', () => {
    const sig = signer.sign({
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"a":1}',
      secret: 's3kr3t',
    });
    expect(
      signer.verify(
        {
          timestamp: '2026-04-28T10:05:00Z',
          rawBody: '{"a":1}',
          secret: 's3kr3t',
        },
        sig,
      ),
    ).toBe(false);
  });

  it('rejects null / undefined / wrong-prefix headers', () => {
    const inputs = {
      timestamp: '2026-04-28T10:00:00Z',
      rawBody: '{"a":1}',
      secret: 's3kr3t',
    };
    expect(signer.verify(inputs, null)).toBe(false);
    expect(signer.verify(inputs, undefined)).toBe(false);
    expect(signer.verify(inputs, 'plain-string')).toBe(false);
    expect(signer.verify(inputs, 'sha1=abc')).toBe(false);
  });

  it('throws if secret is missing', () => {
    expect(() =>
      signer.sign({
        timestamp: '2026-04-28T10:00:00Z',
        rawBody: '{}',
        secret: '',
      }),
    ).toThrow(/secret is required/);
  });

  it('throws if timestamp is missing', () => {
    expect(() =>
      signer.sign({ timestamp: '', rawBody: '{}', secret: 'x' }),
    ).toThrow(/timestamp is required/);
  });
});
