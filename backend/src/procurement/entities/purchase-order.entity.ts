import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../common/data-classification.decorator';

/**
 * PurchaseOrder state machine (R-D07; plan §9.6.1):
 *   DRAFT → SENT → ACKNOWLEDGED → (PARTIALLY_RECEIVED|RECEIVED) → INVOICED → CLOSED
 *   CANCELLED reachable from any non-CLOSED state.
 *
 * In v1.2 (per plan §19.2 Sprint 13 scope) we ship DRAFT/SENT/CANCELLED;
 * the receipt + invoice lifecycle wires up in Sprint 14 (S14.1 GR + S14.2
 * SupplierInvoice). The state-machine guard already accepts the full
 * transition table so subsequent stories do not require re-shipping the
 * enum.
 */
export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partially_received'
  | 'received'
  | 'invoiced'
  | 'closed'
  | 'cancelled';

export type IncotermsCode =
  | 'EXW'
  | 'FCA'
  | 'CPT'
  | 'CIP'
  | 'DAP'
  | 'DPU'
  | 'DDP'
  | 'FAS'
  | 'FOB'
  | 'CFR'
  | 'CIF';

@Entity('purchase_orders')
@Index(['tenantId', 'poNumber'], { unique: true })
@Index(['tenantId', 'status', 'orderDate'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  poNumber: string;

  @Column()
  supplierId: string;

  @Column({ type: 'uuid', nullable: true })
  requisitionId: string | null;

  @Column({ type: 'date' })
  orderDate: Date;

  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate: Date | null;

  @Column({ type: 'uuid', nullable: true })
  shipToWarehouseId: string | null;

  @Column({
    type: 'enum',
    enum: [
      'draft',
      'sent',
      'acknowledged',
      'partially_received',
      'received',
      'invoiced',
      'closed',
      'cancelled',
    ],
    default: 'draft',
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({ length: 50, default: 'sepa_bank_transfer' })
  paymentMethod: string;

  @Column({ length: 3, nullable: true })
  shippingTermsIncoterms: IncotermsCode | null;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'bigint', default: 0 })
  subtotalCents: number;

  @Column({ type: 'bigint', default: 0 })
  taxCents: number;

  @Column({ type: 'bigint', default: 0 })
  totalCents: number;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @OneToMany(() => PurchaseOrderLine, (line) => line.purchaseOrder, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  lines: PurchaseOrderLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_order_lines')
@Index(['tenantId', 'purchaseOrderId'])
export class PurchaseOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  purchaseOrderId: string;

  @Column()
  productId: string;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  quantity: string;

  @Column({ length: 20, default: 'pz' })
  unitOfMeasure: string;

  @Column({ type: 'bigint', default: 0 })
  unitCostCents: number;

  @Column({ type: 'bigint', default: 0 })
  lineTotalCents: number;

  @Column({ type: 'int', default: 22 })
  taxRate: number;

  @Column({ type: 'bigint', default: 0 })
  taxAmountCents: number;

  @Column({ type: 'date', nullable: true })
  expectedDeliveryDate: Date | null;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  receivedQuantity: string;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  invoicedQuantity: string;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @ManyToOne(() => PurchaseOrder, (po) => po.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;
}
