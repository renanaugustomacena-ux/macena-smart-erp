import {
  canQuotationTransition,
  assertQuotationTransition,
  listQuotationTransitions,
} from './quotation.fsm';
import {
  canDdtTransition,
  assertDdtTransition,
  listDdtTransitions,
} from './ddt.fsm';
import type { QuotationStatus } from '../entities/quotation.entity';
import type { DdtStatus } from '../entities/ddt.entity';

describe('Quotation FSM (S15.1)', () => {
  describe('valid transitions', () => {
    it.each<[QuotationStatus, QuotationStatus]>([
      ['draft', 'sent'],
      ['draft', 'expired'],
      ['sent', 'revised'],
      ['sent', 'accepted'],
      ['sent', 'rejected'],
      ['sent', 'expired'],
      ['revised', 'sent'],
      ['revised', 'expired'],
      ['accepted', 'converted'],
      ['accepted', 'expired'],
    ])('allows %s → %s', (from, to) => {
      expect(canQuotationTransition(from, to)).toBe(true);
      expect(() => assertQuotationTransition(from, to)).not.toThrow();
    });
  });

  describe('invalid transitions', () => {
    it.each<[QuotationStatus, QuotationStatus]>([
      ['draft', 'accepted'],
      ['draft', 'converted'],
      ['sent', 'converted'],
      ['rejected', 'sent'],
      ['expired', 'sent'],
      ['converted', 'sent'],
      ['accepted', 'rejected'],
    ])('rejects %s → %s', (from, to) => {
      expect(canQuotationTransition(from, to)).toBe(false);
      expect(() => assertQuotationTransition(from, to)).toThrow();
    });
  });

  it('lists transitions per status', () => {
    expect(listQuotationTransitions('draft').sort()).toEqual(['expired', 'sent']);
    expect(listQuotationTransitions('converted')).toEqual([]);
  });
});

describe('DDT FSM (S15.2)', () => {
  describe('valid transitions', () => {
    it.each<[DdtStatus, DdtStatus]>([
      ['draft', 'issued'],
      ['draft', 'cancelled'],
      ['issued', 'in_transit'],
      ['issued', 'delivered'],
      ['issued', 'cancelled'],
      ['in_transit', 'delivered'],
      ['in_transit', 'returned'],
      ['in_transit', 'lost'],
      ['in_transit', 'disputed'],
      ['delivered', 'invoiced'],
      ['delivered', 'disputed'],
      ['disputed', 'delivered'],
      ['disputed', 'returned'],
      ['disputed', 'lost'],
    ])('allows %s → %s', (from, to) => {
      expect(canDdtTransition(from, to)).toBe(true);
      expect(() => assertDdtTransition(from, to)).not.toThrow();
    });
  });

  describe('invalid transitions', () => {
    it.each<[DdtStatus, DdtStatus]>([
      ['draft', 'delivered'],
      ['draft', 'invoiced'],
      ['issued', 'invoiced'],
      ['delivered', 'cancelled'],
      ['invoiced', 'delivered'],
      ['returned', 'delivered'],
      ['lost', 'delivered'],
      ['cancelled', 'issued'],
    ])('rejects %s → %s', (from, to) => {
      expect(canDdtTransition(from, to)).toBe(false);
      expect(() => assertDdtTransition(from, to)).toThrow();
    });
  });

  it('lists transitions per status', () => {
    expect(listDdtTransitions('draft').sort()).toEqual(['cancelled', 'issued']);
    expect(listDdtTransitions('invoiced')).toEqual([]);
  });
});
