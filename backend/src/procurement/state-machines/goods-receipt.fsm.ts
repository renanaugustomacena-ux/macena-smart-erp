import type { GoodsReceiptStatus } from '../entities/goods-receipt.entity';

/**
 * GoodsReceipt state machine (R-D07; plan §9.6.1).
 *
 *   DRAFT → CONFIRMED | REJECTED
 *   CONFIRMED → PARTIALLY_INSPECTED | INSPECTED | REJECTED
 *   PARTIALLY_INSPECTED → PARTIALLY_INSPECTED | INSPECTED | REJECTED
 *   INSPECTED, REJECTED — terminal.
 */
const TRANSITIONS: Record<GoodsReceiptStatus, GoodsReceiptStatus[]> = {
  draft: ['confirmed', 'rejected'],
  confirmed: ['partially_inspected', 'inspected', 'rejected'],
  partially_inspected: ['partially_inspected', 'inspected', 'rejected'],
  inspected: [],
  rejected: [],
};

export function canGoodsReceiptTransition(
  from: GoodsReceiptStatus,
  to: GoodsReceiptStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertGoodsReceiptTransition(
  from: GoodsReceiptStatus,
  to: GoodsReceiptStatus,
): void {
  if (!canGoodsReceiptTransition(from, to)) {
    throw new Error(
      `Invalid GoodsReceipt transition: ${from} → ${to}. ` +
        `Allowed from ${from}: [${TRANSITIONS[from].join(', ') || '(terminal)'}]`,
    );
  }
}

export function listGoodsReceiptTransitions(
  from: GoodsReceiptStatus,
): GoodsReceiptStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}
