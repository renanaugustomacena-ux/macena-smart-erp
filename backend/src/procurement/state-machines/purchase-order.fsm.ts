import type { PurchaseOrderStatus } from '../entities/purchase-order.entity';

/**
 * PurchaseOrder state machine (R-D07).
 *
 * Forward path:
 *   DRAFT → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → INVOICED → CLOSED
 *
 * Branches:
 *   - From SENT or ACKNOWLEDGED, the receipt status may go directly to
 *     RECEIVED (full delivery in one shipment).
 *   - From PARTIALLY_RECEIVED back to PARTIALLY_RECEIVED is allowed
 *     (idempotent partial receipts).
 *   - CANCELLED is reachable from any non-terminal, non-CLOSED status.
 *   - CLOSED and CANCELLED are terminal.
 *
 * In Sprint 13 (this commit) we ship DRAFT/SENT/CANCELLED behaviourally;
 * the goods-receipt and supplier-invoice transitions land in Sprint 14
 * (S14.1, S14.2). The state-machine table here pre-declares the full
 * future graph so consumers can reason about it safely.
 */
const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['acknowledged', 'partially_received', 'received', 'cancelled'],
  acknowledged: ['partially_received', 'received', 'cancelled'],
  partially_received: ['partially_received', 'received', 'cancelled'],
  received: ['invoiced', 'closed', 'cancelled'],
  invoiced: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

export function canPurchaseOrderTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPurchaseOrderTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): void {
  if (!canPurchaseOrderTransition(from, to)) {
    throw new Error(
      `Invalid PurchaseOrder transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listPurchaseOrderTransitions(
  from: PurchaseOrderStatus,
): PurchaseOrderStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

export function isPurchaseOrderTerminal(status: PurchaseOrderStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}
