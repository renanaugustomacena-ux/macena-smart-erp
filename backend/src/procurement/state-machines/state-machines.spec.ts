import {
  assertPurchaseRequisitionTransition,
  canPurchaseRequisitionTransition,
  listPurchaseRequisitionTransitions,
} from './purchase-requisition.fsm';
import {
  assertPurchaseOrderTransition,
  canPurchaseOrderTransition,
  isPurchaseOrderTerminal,
  listPurchaseOrderTransitions,
} from './purchase-order.fsm';
import type { PurchaseRequisitionStatus } from '../entities/purchase-requisition.entity';
import type { PurchaseOrderStatus } from '../entities/purchase-order.entity';

describe('PurchaseRequisition state machine', () => {
  const validHappyPath: Array<[PurchaseRequisitionStatus, PurchaseRequisitionStatus]> = [
    ['draft', 'submitted'],
    ['submitted', 'approved'],
    ['approved', 'converted'],
  ];

  const validBranches: Array<[PurchaseRequisitionStatus, PurchaseRequisitionStatus]> = [
    ['draft', 'cancelled'],
    ['submitted', 'rejected'],
    ['submitted', 'cancelled'],
    ['approved', 'cancelled'],
    ['rejected', 'cancelled'],
  ];

  const invalid: Array<[PurchaseRequisitionStatus, PurchaseRequisitionStatus]> = [
    ['draft', 'approved'],
    ['draft', 'converted'],
    ['draft', 'rejected'],
    ['submitted', 'converted'],
    ['approved', 'submitted'],
    ['converted', 'cancelled'],
    ['converted', 'approved'],
    ['cancelled', 'draft'],
    ['cancelled', 'approved'],
    ['rejected', 'approved'],
  ];

  for (const [from, to] of validHappyPath) {
    it(`allows happy path ${from} → ${to}`, () => {
      expect(canPurchaseRequisitionTransition(from, to)).toBe(true);
      expect(() => assertPurchaseRequisitionTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of validBranches) {
    it(`allows branch ${from} → ${to}`, () => {
      expect(canPurchaseRequisitionTransition(from, to)).toBe(true);
    });
  }

  for (const [from, to] of invalid) {
    it(`rejects invalid ${from} → ${to}`, () => {
      expect(canPurchaseRequisitionTransition(from, to)).toBe(false);
      expect(() => assertPurchaseRequisitionTransition(from, to)).toThrow(
        /Invalid PurchaseRequisition transition/,
      );
    });
  }

  it('lists transitions per state', () => {
    expect(listPurchaseRequisitionTransitions('draft').sort()).toEqual([
      'cancelled',
      'submitted',
    ]);
    expect(listPurchaseRequisitionTransitions('converted')).toEqual([]);
    expect(listPurchaseRequisitionTransitions('cancelled')).toEqual([]);
  });
});

describe('PurchaseOrder state machine', () => {
  const validHappyPath: Array<[PurchaseOrderStatus, PurchaseOrderStatus]> = [
    ['draft', 'sent'],
    ['sent', 'acknowledged'],
    ['acknowledged', 'received'],
    ['received', 'invoiced'],
    ['invoiced', 'closed'],
  ];

  const validBranches: Array<[PurchaseOrderStatus, PurchaseOrderStatus]> = [
    ['draft', 'cancelled'],
    ['sent', 'partially_received'],
    ['sent', 'received'],
    ['sent', 'cancelled'],
    ['acknowledged', 'partially_received'],
    ['acknowledged', 'cancelled'],
    ['partially_received', 'partially_received'], // idempotent partial receipt
    ['partially_received', 'received'],
    ['partially_received', 'cancelled'],
    ['received', 'closed'],
    ['received', 'cancelled'],
    ['invoiced', 'cancelled'],
  ];

  const invalid: Array<[PurchaseOrderStatus, PurchaseOrderStatus]> = [
    ['draft', 'received'],
    ['draft', 'invoiced'],
    ['draft', 'closed'],
    ['sent', 'closed'],
    ['acknowledged', 'invoiced'],
    ['received', 'sent'],
    ['invoiced', 'received'],
    ['closed', 'sent'],
    ['cancelled', 'draft'],
    ['cancelled', 'sent'],
  ];

  for (const [from, to] of validHappyPath) {
    it(`allows happy path ${from} → ${to}`, () => {
      expect(canPurchaseOrderTransition(from, to)).toBe(true);
    });
  }

  for (const [from, to] of validBranches) {
    it(`allows branch ${from} → ${to}`, () => {
      expect(canPurchaseOrderTransition(from, to)).toBe(true);
    });
  }

  for (const [from, to] of invalid) {
    it(`rejects invalid ${from} → ${to}`, () => {
      expect(canPurchaseOrderTransition(from, to)).toBe(false);
      expect(() => assertPurchaseOrderTransition(from, to)).toThrow(
        /Invalid PurchaseOrder transition/,
      );
    });
  }

  it('flags terminal states', () => {
    expect(isPurchaseOrderTerminal('closed')).toBe(true);
    expect(isPurchaseOrderTerminal('cancelled')).toBe(true);
    expect(isPurchaseOrderTerminal('draft')).toBe(false);
    expect(isPurchaseOrderTerminal('sent')).toBe(false);
  });

  it('lists transitions per state', () => {
    expect(listPurchaseOrderTransitions('closed')).toEqual([]);
    expect(listPurchaseOrderTransitions('cancelled')).toEqual([]);
    expect(listPurchaseOrderTransitions('sent').sort()).toEqual([
      'acknowledged',
      'cancelled',
      'partially_received',
      'received',
    ]);
  });
});
