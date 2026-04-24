import { computeIva } from './iva-regimes';

/**
 * Unit tests exercise every branch added in gap H-04:
 * forfettario, minimi, reverse charge, split payment, ordinary.
 */
describe('computeIva', () => {
  it('returns zero IVA with N2.2 nature for RF19 forfettario', () => {
    const r = computeIva({
      regime: 'RF19',
      taxableAmount: 1000,
      requestedIvaRate: 22,
      splitPayment: false,
      reverseCharge: false,
    });
    expect(r.ivaAmount).toBe(0);
    expect(r.ivaNature).toBe('N2.2');
    expect(r.payableByBuyer).toBe(1000);
    expect(r.reasoning).toMatch(/forfettario/);
  });

  it('returns zero IVA with N2.2 nature for RF02 minimi', () => {
    const r = computeIva({
      regime: 'RF02',
      taxableAmount: 500,
      requestedIvaRate: 22,
      splitPayment: false,
      reverseCharge: false,
    });
    expect(r.ivaAmount).toBe(0);
    expect(r.ivaNature).toBe('N2.2');
    expect(r.reasoning).toMatch(/minimi/);
  });

  it('returns zero IVA with N6.9 nature for reverse charge', () => {
    const r = computeIva({
      regime: 'RF01',
      taxableAmount: 2000,
      requestedIvaRate: 22,
      splitPayment: false,
      reverseCharge: true,
    });
    expect(r.ivaAmount).toBe(0);
    expect(r.ivaNature).toBe('N6.9');
    expect(r.treasuryReceivableFromSeller).toBe(0);
  });

  it('split-payment keeps IVA computed but receivable equals base', () => {
    const r = computeIva({
      regime: 'RF01',
      taxableAmount: 1000,
      requestedIvaRate: 22,
      splitPayment: true,
      reverseCharge: false,
    });
    expect(r.ivaAmount).toBe(220);
    expect(r.payableByBuyer).toBe(1000); // only taxable base
    expect(r.treasuryReceivableFromSeller).toBe(0);
  });

  it('ordinary regime computes IVA and sums to payableByBuyer', () => {
    const r = computeIva({
      regime: 'RF01',
      taxableAmount: 100,
      requestedIvaRate: 22,
      splitPayment: false,
      reverseCharge: false,
    });
    expect(r.ivaRate).toBe(22);
    expect(r.ivaAmount).toBe(22);
    expect(r.payableByBuyer).toBe(122);
    expect(r.treasuryReceivableFromSeller).toBe(22);
  });
});
