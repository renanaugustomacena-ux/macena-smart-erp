import type { QuotationStatus } from '../entities/quotation.entity';

/**
 * Quotation FSM (R-D07; plan §31.1 Sprint 15 / S15.1).
 *
 *   DRAFT → SENT | EXPIRED                           (caller can pre-expire a draft)
 *   SENT → REVISED | ACCEPTED | REJECTED | EXPIRED
 *   REVISED → SENT | EXPIRED
 *   ACCEPTED → CONVERTED | EXPIRED                   (accepted-but-still-not-converted can lapse)
 *   CONVERTED, REJECTED, EXPIRED — terminal.
 */
const TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent', 'expired'],
  sent: ['revised', 'accepted', 'rejected', 'expired'],
  revised: ['sent', 'expired'],
  accepted: ['converted', 'expired'],
  converted: [],
  rejected: [],
  expired: [],
};

export function canQuotationTransition(
  from: QuotationStatus,
  to: QuotationStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertQuotationTransition(
  from: QuotationStatus,
  to: QuotationStatus,
): void {
  if (!canQuotationTransition(from, to)) {
    throw new Error(
      `Invalid Quotation transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listQuotationTransitions(
  from: QuotationStatus,
): QuotationStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
