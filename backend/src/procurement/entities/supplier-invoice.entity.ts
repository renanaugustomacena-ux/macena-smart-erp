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
 * SupplierInvoice (TD16 inbound; PEC-ingested or manual) state machine
 * (R-D07; plan §9.6.1).
 *
 *   RECEIVED → MATCHED → APPROVED → PAID
 *   RECEIVED → DISPUTED → REJECTED | APPROVED (after dispute resolution)
 *   APPROVED → CANCELLED (rare; for accounting reversal)
 *   PAID, REJECTED, CANCELLED — terminal.
 *
 * `matched` is the 3-way-match success state (PO ↔ GR ↔ SI within
 * tolerance); `disputed` flags an out-of-tolerance discrepancy that
 * needs human resolution.
 */
export type SupplierInvoiceStatus =
  | 'received'
  | 'matched'
  | 'approved'
  | 'disputed'
  | 'rejected'
  | 'paid'
  | 'cancelled';

export type SupplierInvoiceReceivedVia = 'pec' | 'manual' | 'ocr' | 'sdi';

@Entity('supplier_invoices')
@Index(['tenantId', 'supplierId', 'supplierInvoiceNumber'], { unique: true })
@Index(['tenantId', 'status', 'paymentDueDate'])
export class SupplierInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  supplierId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  supplierInvoiceNumber: string;

  @Column({ type: 'date' })
  supplierInvoiceDate: Date;

  @Column({ type: 'timestamptz' })
  receivedDate: Date;

  @Column({
    type: 'enum',
    enum: ['pec', 'manual', 'ocr', 'sdi'],
    default: 'manual',
  })
  receivedVia: SupplierInvoiceReceivedVia;

  /** PEC message-id when receivedVia=pec; SDI sdiTransmissionId when sdi. */
  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  externalMessageId: string | null;

  @Column({ length: 500, nullable: true })
  @DataClassification('confidential')
  fatturaPaXmlPath: string | null;

  @Column({ type: 'bigint', default: 0 })
  subtotalCents: number;

  @Column({ type: 'bigint', default: 0 })
  taxCents: number;

  @Column({ type: 'bigint', default: 0 })
  totalCents: number;

  /** [{rate, taxableCents, taxCents, naturaCode?}] */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  ivaBreakdown: Array<{
    rate: number;
    taxableCents: number;
    taxCents: number;
    naturaCode?: string;
  }>;

  @Column({ type: 'date' })
  paymentDueDate: Date;

  @Column({ type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({
    type: 'enum',
    enum: [
      'received',
      'matched',
      'approved',
      'disputed',
      'rejected',
      'paid',
      'cancelled',
    ],
    default: 'received',
  })
  status: SupplierInvoiceStatus;

  /** PO ids matched against this invoice (3-way). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  poIds: string[];

  /** Discrepancy details from 3-way match (qty / price / total tolerance failures). */
  @Column({ type: 'jsonb', nullable: true })
  discrepancies: SupplierInvoiceDiscrepancy[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  matchedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  matchedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  paymentBatchId: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  /**
   * Counterparty country (ISO 3166-1 alpha-2). Optional enrichment used by
   * the Intrastat aggregator (S16.2) to detect intra-EU acquisitions.
   * Populated by the PEC ingester when the FatturaPA carries a foreign
   * `IdPaese`, or manually by the accountant on legacy imports.
   */
  @Column({ length: 2, nullable: true })
  partnerCountry: string | null;

  /** Counterparty VAT number with country prefix (e.g., `DE123456789`). */
  @Column({ length: 32, nullable: true })
  @DataClassification('confidential')
  partnerVatNumber: string | null;

  @OneToMany(() => SupplierInvoiceLine, (l) => l.supplierInvoice, {
    cascade: ['insert', 'update'],
  })
  lines: SupplierInvoiceLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface SupplierInvoiceDiscrepancy {
  type: 'quantity' | 'price' | 'total' | 'unmatched_line' | 'missing_po';
  poLineId?: string;
  invoiceLineId?: string;
  expectedCents?: number;
  actualCents?: number;
  expectedQuantity?: string;
  actualQuantity?: string;
  message: string;
}

@Entity('supplier_invoice_lines')
@Index(['tenantId', 'supplierInvoiceId'])
@Index(['tenantId', 'poLineId'])
export class SupplierInvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  supplierInvoiceId: string;

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

  @Column({ length: 10, nullable: true })
  naturaCode: string | null;

  @Column({ type: 'uuid', nullable: true })
  poLineId: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @ManyToOne(() => SupplierInvoice, (si) => si.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierInvoiceId' })
  supplierInvoice: SupplierInvoice;
}
