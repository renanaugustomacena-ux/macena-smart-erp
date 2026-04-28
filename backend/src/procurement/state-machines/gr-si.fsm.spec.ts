import {
  assertGoodsReceiptTransition,
  canGoodsReceiptTransition,
  listGoodsReceiptTransitions,
} from './goods-receipt.fsm';
import {
  assertSupplierInvoiceTransition,
  canSupplierInvoiceTransition,
  listSupplierInvoiceTransitions,
} from './supplier-invoice.fsm';
import type { GoodsReceiptStatus } from '../entities/goods-receipt.entity';
import type { SupplierInvoiceStatus } from '../entities/supplier-invoice.entity';

describe('GoodsReceipt state machine', () => {
  const valid: Array<[GoodsReceiptStatus, GoodsReceiptStatus]> = [
    ['draft', 'confirmed'],
    ['draft', 'rejected'],
    ['confirmed', 'partially_inspected'],
    ['confirmed', 'inspected'],
    ['confirmed', 'rejected'],
    ['partially_inspected', 'partially_inspected'],
    ['partially_inspected', 'inspected'],
    ['partially_inspected', 'rejected'],
  ];

  const invalid: Array<[GoodsReceiptStatus, GoodsReceiptStatus]> = [
    ['draft', 'inspected'],
    ['draft', 'partially_inspected'],
    ['confirmed', 'draft'],
    ['inspected', 'confirmed'],
    ['inspected', 'rejected'],
    ['rejected', 'confirmed'],
  ];

  for (const [from, to] of valid) {
    it(`allows ${from} → ${to}`, () => {
      expect(canGoodsReceiptTransition(from, to)).toBe(true);
      expect(() => assertGoodsReceiptTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of invalid) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canGoodsReceiptTransition(from, to)).toBe(false);
      expect(() => assertGoodsReceiptTransition(from, to)).toThrow(
        /Invalid GoodsReceipt transition/,
      );
    });
  }

  it('lists transitions per state', () => {
    expect(listGoodsReceiptTransitions('inspected')).toEqual([]);
    expect(listGoodsReceiptTransitions('rejected')).toEqual([]);
  });
});

describe('SupplierInvoice state machine', () => {
  const valid: Array<[SupplierInvoiceStatus, SupplierInvoiceStatus]> = [
    ['received', 'matched'],
    ['received', 'disputed'],
    ['received', 'rejected'],
    ['received', 'cancelled'],
    ['matched', 'approved'],
    ['matched', 'disputed'],
    ['matched', 'cancelled'],
    ['disputed', 'approved'],
    ['disputed', 'rejected'],
    ['disputed', 'cancelled'],
    ['approved', 'paid'],
    ['approved', 'cancelled'],
  ];

  const invalid: Array<[SupplierInvoiceStatus, SupplierInvoiceStatus]> = [
    ['received', 'approved'],
    ['received', 'paid'],
    ['matched', 'received'],
    ['matched', 'rejected'],
    ['matched', 'paid'],
    ['approved', 'received'],
    ['approved', 'matched'],
    ['paid', 'approved'],
    ['paid', 'cancelled'],
    ['rejected', 'received'],
    ['cancelled', 'received'],
  ];

  for (const [from, to] of valid) {
    it(`allows ${from} → ${to}`, () => {
      expect(canSupplierInvoiceTransition(from, to)).toBe(true);
      expect(() => assertSupplierInvoiceTransition(from, to)).not.toThrow();
    });
  }

  for (const [from, to] of invalid) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canSupplierInvoiceTransition(from, to)).toBe(false);
      expect(() => assertSupplierInvoiceTransition(from, to)).toThrow(
        /Invalid SupplierInvoice transition/,
      );
    });
  }

  it('lists transitions per state', () => {
    expect(listSupplierInvoiceTransitions('paid')).toEqual([]);
    expect(listSupplierInvoiceTransitions('rejected')).toEqual([]);
    expect(listSupplierInvoiceTransitions('cancelled')).toEqual([]);
  });
});
