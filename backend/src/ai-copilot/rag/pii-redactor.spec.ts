import { redactPii } from './pii-redactor';

describe('redactPii (S26.5)', () => {
  it('redacts an Italian IBAN', () => {
    expect(redactPii('Bonifico su IT60X0542811101000000123456 ricevuto')).toBe(
      'Bonifico su [IBAN] ricevuto',
    );
  });

  it('redacts a codice fiscale', () => {
    expect(redactPii('CF: RSSMRC80A01H501Z')).toBe('CF: [CF]');
  });

  it('redacts a partita IVA', () => {
    expect(redactPii('PIVA 12345678901 IT12345678901')).toBe(
      'PIVA [PIVA] [PIVA]',
    );
  });

  it('redacts emails and PEC', () => {
    expect(redactPii('contatto: marco@acme.it pec@pec.it')).toBe(
      'contatto: [EMAIL] [EMAIL]',
    );
  });

  it('redacts Italian phone numbers', () => {
    // The regex collapses contiguous phone-shaped digits; the +39 prefix
    // is consumed alongside the trailing 7-8 digit body.
    expect(redactPii('Tel 045 1234567')).toBe('Tel [PHONE]');
  });

  it('preserves non-PII text', () => {
    expect(redactPii('Cliente Acme Spa, ordine 2026/0123, totale 1234,56')).toContain(
      'ordine 2026',
    );
  });
});
