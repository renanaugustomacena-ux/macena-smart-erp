import { createHash } from 'crypto';

/**
 * NIST SP 800-63B password policy helpers.
 *
 * Closes gap G-06. Checks the password against the HIBP "k-anonymity"
 * pwned-passwords range endpoint. The first 5 chars of the SHA-1 are
 * sent; the full hash never leaves the process. If the outbound call
 * fails for any reason (DNS, firewall, HIBP down) we fail OPEN — the
 * breach check is advisory; primary password quality is enforced by
 * the RegisterDto MinLength + Matches validators.
 */
export interface BreachCheckResult {
  breached: boolean;
  count: number;
  /** False if the check could not run (network, env opted out, etc.). */
  advisory: boolean;
}

const HIBP_ENDPOINT = 'https://api.pwnedpasswords.com/range/';

export async function checkPasswordBreach(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BreachCheckResult> {
  if (process.env.DISABLE_HIBP_CHECK === 'true') {
    return { breached: false, count: 0, advisory: true };
  }
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(`${HIBP_ENDPOINT}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'SmartERP/1.0' },
    });
    if (!res.ok) {
      return { breached: false, count: 0, advisory: true };
    }
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, countRaw] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countRaw ?? '0', 10);
        return { breached: count > 0, count, advisory: false };
      }
    }
    return { breached: false, count: 0, advisory: false };
  } catch {
    return { breached: false, count: 0, advisory: true };
  }
}

/**
 * Basic structural enforcement on top of the NIST policy: minimum 10,
 * rejects well-known weak passwords explicitly. Breach check is the
 * secondary defence via `checkPasswordBreach`.
 */
const KNOWN_WEAK = new Set([
  'password12',
  'password123',
  'qwerty1234',
  'letmein12',
  'welcome12',
  'admin12345',
  '1234567890',
]);

export function validatePasswordPolicy(password: string): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (password.length < 10) reasons.push('must be at least 10 characters long');
  if (password.length > 128) reasons.push('must be at most 128 characters long');
  if (!/[A-Za-z]/.test(password)) reasons.push('must contain at least one letter');
  if (!/\d/.test(password)) reasons.push('must contain at least one digit');
  if (KNOWN_WEAK.has(password.toLowerCase())) reasons.push('is in the list of well-known weak passwords');
  return { valid: reasons.length === 0, reasons };
}
