import { IossService } from './ioss.service';

describe('IossService (S43)', () => {
  const svc = new IossService();

  it('validates IM-prefixed numbers', () => {
    expect(svc.validate('IM1234567890XX')).toBe(true);
    expect(svc.validate('IT12345678901')).toBe(false);
    expect(svc.validate('IM12345')).toBe(false);
  });

  it('flags consignment value above the €150 threshold', () => {
    const r = svc.checkInvoice({
      iossNumber: 'IM1234567890AA',
      consigneeCountry: 'IT',
      consignmentValueCents: 20_000,
      isB2C: true,
    });
    expect(r.thresholdRespected).toBe(false);
    expect(r.warnings.join(' ')).toContain('150');
  });

  it('flags B2B as non-IOSS', () => {
    const r = svc.checkInvoice({
      iossNumber: 'IM1234567890AA',
      consigneeCountry: 'DE',
      consignmentValueCents: 10_000,
      isB2C: false,
    });
    expect(r.warnings.some((w) => /B2B|B2C/.test(w))).toBe(true);
  });

  it('converts foreign-currency cents to EUR cents', () => {
    // 100 USD at 1.10 EURUSD → 9091 cents EUR.
    expect(svc.convertToEurCents(10_000, 1.1)).toBe(9091);
  });
});
