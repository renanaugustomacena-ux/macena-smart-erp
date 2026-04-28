import type { SupplierInvoiceStatus } from '../entities/supplier-invoice.entity';

/**
 * SupplierInvoice state machine (R-D07; plan §9.6.1).
 *
 *   RECEIVED → MATCHED | DISPUTED | REJECTED | CANCELLED
 *   MATCHED → APPROVED | DISPUTED | CANCELLED
 *   DISPUTED → APPROVED | REJECTED | CANCELLED
 *   APPROVED → PAID | CANCELLED
 *   PAID, REJECTED, CANCELLED — terminal.
 */
const TRANSITIONS: Record<SupplierInvoiceStatus, SupplierInvoiceStatus[]> = {
  received: ['matched', 'disputed', 'rejected', 'cancelled'],
  matched: ['approved', 'disputed', 'cancelled'],
  disputed: ['approved', 'rejected', 'cancelled'],
  approved: ['paid', 'cancelled'],
  paid: [],
  rejected: [],
  cancelled: [],
};

export function canSupplierInvoiceTransition(
  from: SupplierInvoiceStatus,
  to: SupplierInvoiceStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertSupplierInvoiceTransition(
  from: SupplierInvoiceStatus,
  to: SupplierInvoiceStatus,
): void {
  if (!canSupplierInvoiceTransition(from, to)) {
    throw new Error(
      `Invalid SupplierInvoice transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listSupplierInvoiceTransitions(
  from: SupplierInvoiceStatus,
): SupplierInvoiceStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
