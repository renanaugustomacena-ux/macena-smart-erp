import {
  assertRequestForQuoteTransition,
  canRequestForQuoteTransition,
  listRequestForQuoteTransitions,
} from './request-for-quote.fsm';
import type { RequestForQuoteStatus } from '../entities/request-for-quote.entity';

describe('RequestForQuote state machine', () => {
  const valid: Array<[RequestForQuoteStatus, RequestForQuoteStatus]> = [
    ['draft', 'sent'],
    ['draft', 'cancelled'],
    ['sent', 'quotes_received'],
    ['sent', 'expired'],
    ['sent', 'cancelled'],
    ['quotes_received', 'awarded'],
    ['quotes_received', 'expired'],
    ['quotes_received', 'cancelled'],
    ['awarded', 'converted'],
    ['awarded', 'cancelled'],
    ['expired', 'cancelled'],
  ];

  const invalid: Array<[RequestForQuoteStatus, RequestForQuoteStatus]> = [
    ['draft', 'awarded'],
    ['draft', 'converted'],
    ['draft', 'quotes_received'],
    ['sent', 'awarded'],
    ['sent', 'converted'],
    ['quotes_received', 'sent'],
    ['quotes_received', 'converted'],
    ['awarded', 'expired'],
    ['expired', 'awarded'],
    ['converted', 'cancelled'],
    ['cancelled', 'draft'],
  ];

  for (const [from, to] of valid) {
    it(`allows ${from} → ${to}`, () => {
      expect(canRequestForQuoteTransition(from, to)).toBe(true);
      expect(() => assertRequestForQuoteTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of invalid) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canRequestForQuoteTransition(from, to)).toBe(false);
      expect(() => assertRequestForQuoteTransition(from, to)).toThrow(
        /Invalid RequestForQuote transition/,
      );
    });
  }

  it('lists transitions per state', () => {
    expect(listRequestForQuoteTransitions('draft').sort()).toEqual([
      'cancelled',
      'sent',
    ]);
    expect(listRequestForQuoteTransitions('converted')).toEqual([]);
    expect(listRequestForQuoteTransitions('cancelled')).toEqual([]);
  });
});
