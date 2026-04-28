import type { DdtStatus } from '../entities/ddt.entity';

/**
 * DDT FSM (R-D07; plan §31.1 Sprint 15 / S15.2).
 *
 *   DRAFT → ISSUED | CANCELLED
 *   ISSUED → IN_TRANSIT | DELIVERED | CANCELLED        (carrier may collect-and-deliver same day; allow direct ISSUED→DELIVERED for hand-carry)
 *   IN_TRANSIT → DELIVERED | RETURNED | LOST | DISPUTED
 *   DELIVERED → INVOICED | DISPUTED                    (DELIVERED is the terminal logistics state; INVOICED is the fiscal state)
 *   DISPUTED → DELIVERED | RETURNED | LOST            (out of dispute resolution)
 *   INVOICED, RETURNED, LOST, CANCELLED — terminal.
 */
const TRANSITIONS: Record<DdtStatus, DdtStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['in_transit', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'returned', 'lost', 'disputed'],
  delivered: ['invoiced', 'disputed'],
  disputed: ['delivered', 'returned', 'lost'],
  invoiced: [],
  returned: [],
  lost: [],
  cancelled: [],
};

export function canDdtTransition(from: DdtStatus, to: DdtStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertDdtTransition(from: DdtStatus, to: DdtStatus): void {
  if (!canDdtTransition(from, to)) {
    throw new Error(
      `Invalid DDT transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listDdtTransitions(from: DdtStatus): DdtStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
