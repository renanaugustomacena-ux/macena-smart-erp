import type { RequestForQuoteStatus } from '../entities/request-for-quote.entity';

/**
 * RequestForQuote state machine (R-D07).
 *
 *   DRAFT → SENT | CANCELLED
 *   SENT → QUOTES_RECEIVED | EXPIRED | CANCELLED
 *   QUOTES_RECEIVED → AWARDED | EXPIRED | CANCELLED
 *   AWARDED → CONVERTED | CANCELLED
 *   EXPIRED → CANCELLED
 *   CONVERTED, CANCELLED — terminal.
 */
const TRANSITIONS: Record<RequestForQuoteStatus, RequestForQuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['quotes_received', 'expired', 'cancelled'],
  quotes_received: ['awarded', 'expired', 'cancelled'],
  awarded: ['converted', 'cancelled'],
  expired: ['cancelled'],
  converted: [],
  cancelled: [],
};

export function canRequestForQuoteTransition(
  from: RequestForQuoteStatus,
  to: RequestForQuoteStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertRequestForQuoteTransition(
  from: RequestForQuoteStatus,
  to: RequestForQuoteStatus,
): void {
  if (!canRequestForQuoteTransition(from, to)) {
    throw new Error(
      `Invalid RequestForQuote transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listRequestForQuoteTransitions(
  from: RequestForQuoteStatus,
): RequestForQuoteStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
