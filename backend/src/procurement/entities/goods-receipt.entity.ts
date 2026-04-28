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
 * GoodsReceipt state machine (R-D07; plan §9.6.1).
 *
 *   DRAFT → CONFIRMED → INSPECTED | REJECTED
 *   CONFIRMED → PARTIALLY_INSPECTED → INSPECTED | REJECTED
 *   INSPECTED, REJECTED — terminal.
 *
 * `confirmed` triggers stock movements (INBOUND for accepted qty,
 * RETURN for rejected qty); `inspected` records the QC verdict from
 * the quality module (Sprint 18+).
 */
export type GoodsReceiptStatus =
  | 'draft'
  | 'confirmed'
  | 'partially_inspected'
  | 'inspected'
  | 'rejected';

@Entity('goods_receipts')
@Index(['tenantId', 'grNumber'], { unique: true })
@Index(['tenantId', 'poId', 'receiptDate'])
export class GoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  grNumber: string;

  @Column({ type: 'uuid' })
  poId: string;

  @Column({ type: 'uuid' })
  supplierId: string;

  @Column({ type: 'uuid' })
  warehouseId: string;

  @Column({ type: 'date' })
  receiptDate: Date;

  @Column()
  receivedBy: string;

  @Column({ length: 100, nullable: true })
  carrierTrackingNumber: string | null;

  /** Supplier-side DDT (documento di trasporto) reference. */
  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  supplierDdtNumber: string | null;

  @Column({ type: 'date', nullable: true })
  supplierDdtDate: Date | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'confirmed', 'partially_inspected', 'inspected', 'rejected'],
    default: 'draft',
  })
  status: GoodsReceiptStatus;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  inspectedAt: Date | null;

  @OneToMany(() => GoodsReceiptLine, (l) => l.goodsReceipt, {
    cascade: ['insert', 'update'],
  })
  lines: GoodsReceiptLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('goods_receipt_lines')
@Index(['tenantId', 'goodsReceiptId'])
@Index(['tenantId', 'poLineId'])
export class GoodsReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  goodsReceiptId: string;

  @Column({ type: 'uuid' })
  poLineId: string;

  @Column()
  productId: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  receivedQuantity: string;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  acceptedQuantity: string;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  rejectedQuantity: string;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  lotId: string | null;

  /** Per-piece serial numbers (for serialised products). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  serialIds: string[];

  @Column({ type: 'uuid', nullable: true })
  inspectionId: string | null;

  @Column({ length: 50, nullable: true })
  warehouseLocation: string | null;

  @ManyToOne(() => GoodsReceipt, (gr) => gr.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goodsReceiptId' })
  goodsReceipt: GoodsReceipt;
}
