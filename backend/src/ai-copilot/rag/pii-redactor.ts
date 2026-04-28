/**
 * PII redactor (plan §31.2 Sprint 26 / S26.5).
 *
 * Runs before any payload is sent to the LLM or written into the RAG
 * vector store. Italian-specific patterns:
 *   - Codice Fiscale (16 alphanumeric chars matching the AdE checksum
 *     shape).
 *   - Partita IVA (11 digits prefixed by IT or naked).
 *   - IBAN (IT prefix + 25 chars).
 *   - PEC / email addresses.
 *   - Credit-card numbers (Luhn-shaped 16-digit groups).
 *   - Phone numbers (Italian +39 + 8-10 digits).
 *
 * Replacement preserves the token shape so the LLM can still reason
 * about the field (e.g., a CF becomes `[CF]`).
 */
const PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // IBAN (IT only — extend to other countries when SmartERP goes
  // international in Sprint 41).
  { regex: /\bIT\d{2}[A-Z]\d{22}\b/g, replacement: '[IBAN]' },
  // Codice Fiscale shape (looser than the official spec; intentional —
  // we redact rather than parse).
  {
    regex: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g,
    replacement: '[CF]',
  },
  // Partita IVA with optional IT prefix.
  { regex: /\b(?:IT)?\d{11}\b/g, replacement: '[PIVA]' },
  // Email + PEC.
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  // Credit card (very loose).
  {
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[CARD]',
  },
  // Italian phone (+39 + 8-10 digits, optional spacing).
  {
    regex: /\b(?:\+39[\s-]?)?\d{2,4}[\s-]?\d{6,8}\b/g,
    replacement: '[PHONE]',
  },
];

export function redactPii(input: string): string {
  let s = input;
  for (const p of PATTERNS) {
    s = s.replace(p.regex, p.replacement);
  }
  return s;
}
