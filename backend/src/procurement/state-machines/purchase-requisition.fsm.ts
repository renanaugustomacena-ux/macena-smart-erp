import type { PurchaseRequisitionStatus } from '../entities/purchase-requisition.entity';

/**
 * PurchaseRequisition state machine (R-D07).
 *
 * Allowed transitions:
 *   DRAFT → SUBMITTED | CANCELLED
 *   SUBMITTED → APPROVED | REJECTED | CANCELLED
 *   APPROVED → CONVERTED | CANCELLED
 *   REJECTED → CANCELLED
 *   CONVERTED, CANCELLED — terminal.
 */
const TRANSITIONS: Record<PurchaseRequisitionStatus, PurchaseRequisitionStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['converted', 'cancelled'],
  rejected: ['cancelled'],
  converted: [],
  cancelled: [],
};

export function canPurchaseRequisitionTransition(
  from: PurchaseRequisitionStatus,
  to: PurchaseRequisitionStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPurchaseRequisitionTransition(
  from: PurchaseRequisitionStatus,
  to: PurchaseRequisitionStatus,
): void {
  if (!canPurchaseRequisitionTransition(from, to)) {
    throw new Error(
      `Invalid PurchaseRequisition transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listPurchaseRequisitionTransitions(
  from: PurchaseRequisitionStatus,
): PurchaseRequisitionStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
