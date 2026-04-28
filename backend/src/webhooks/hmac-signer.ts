import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 webhook signer (ADR-037; pure logic, no DB / network).
 *
 * Signing scheme:
 *   signedString = `${timestamp}.${rawBody}`
 *   signature    = `sha256=${hex(HMAC-SHA256(secret, signedString))}`
 *
 * The `${timestamp}.${rawBody}` framing matches the GitHub / Stripe /
 * Twilio convention so existing consumer-side libraries already work.
 *
 * Verification uses constant-time comparison via `crypto.timingSafeEqual`
 * to avoid timing side channels.
 */
export interface SignatureInputs {
  /** RFC 3339 UTC timestamp (second precision). */
  timestamp: string;
  /** Raw request body, exactly as it will be sent over the wire. */
  rawBody: string;
  /** HMAC secret (plaintext at sign time; never logged). */
  secret: string;
}

export class HmacSigner {
  private static readonly PREFIX = 'sha256=';

  /**
   * Returns the value to put in the `X-SmartERP-Signature` header.
   */
  sign(inputs: SignatureInputs): string {
    const { timestamp, rawBody, secret } = inputs;
    if (!secret) {
      throw new Error('HmacSigner.sign: secret is required');
    }
    if (!timestamp) {
      throw new Error('HmacSigner.sign: timestamp is required');
    }
    const signedString = `${timestamp}.${rawBody}`;
    const mac = createHmac('sha256', secret).update(signedString).digest('hex');
    return `${HmacSigner.PREFIX}${mac}`;
  }

  /**
   * Returns true if the signature is valid for the given inputs.
   * Uses constant-time comparison.
   */
  verify(
    inputs: SignatureInputs,
    candidateHeader: string | null | undefined,
  ): boolean {
    if (!candidateHeader || !candidateHeader.startsWith(HmacSigner.PREFIX)) {
      return false;
    }
    const expected = this.sign(inputs);
    const a = Buffer.from(expected);
    const b = Buffer.from(candidateHeader);
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
