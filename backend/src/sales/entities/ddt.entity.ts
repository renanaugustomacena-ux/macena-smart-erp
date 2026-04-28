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
 * DDT (Documento di Trasporto) — Italian "transport document" required
 * by DPR 472/96 art. 1 + DPR 633/1972 art. 21 to accompany goods in
 * transit when the invoice is "differita" (issued by the 15th of the
 * following month).
 *
 * State machine (R-D07; plan §31.1 Sprint 15 / S15.2):
 *   DRAFT → ISSUED → IN_TRANSIT → DELIVERED | RETURNED | LOST | DISPUTED
 *   DELIVERED → INVOICED   (when bundled into the differita invoice)
 *   ISSUED → CANCELLED      (only before goods leave; rare)
 *   DELIVERED, INVOICED, RETURNED, LOST, DISPUTED, CANCELLED — terminal.
 *
 * `causaleTrasporto` is the regulated reason code per Italian usage:
 *   - "vendita"          (the typical sale-of-goods case)
 *   - "conto_visione"    (consignment for evaluation)
 *   - "conto_lavorazione" (job-work / subcontracting)
 *   - "reso"             (return to supplier)
 *   - "tentata_vendita"  (mobile sales — pre-sale truck stocking)
 *   - "campionatura"     (samples)
 *   - "altro"
 */
export type DdtStatus =
  | 'draft'
  | 'issued'
  | 'in_transit'
  | 'delivered'
  | 'invoiced'
  | 'returned'
  | 'lost'
  | 'disputed'
  | 'cancelled';

export type DdtCausale =
  | 'vendita'
  | 'conto_visione'
  | 'conto_lavorazione'
  | 'reso'
  | 'tentata_vendita'
  | 'campionatura'
  | 'altro';

@Entity('ddts')
@Index(['tenantId', 'ddtNumber'], { unique: true })
@Index(['tenantId', 'status', 'issueDate'])
@Index(['tenantId', 'customerId', 'issueDate'])
@Index(['tenantId', 'salesOrderId'])
export class Ddt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  ddtNumber: string;

  @Column({ type: 'uuid' })
  customerId: string;

  /** Optional link back to the originating SalesOrder. */
  @Column({ type: 'uuid', nullable: true })
  salesOrderId: string | null;

  @Column({ type: 'date' })
  issueDate: Date;

  /** RFC 3339 timestamp when goods physically left the warehouse. */
  @Column({ type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({
    type: 'enum',
    enum: [
      'draft',
      'issued',
      'in_transit',
      'delivered',
      'invoiced',
      'returned',
      'lost',
      'disputed',
      'cancelled',
    ],
    default: 'draft',
  })
  status: DdtStatus;

  @Column({
    type: 'enum',
    enum: [
      'vendita',
      'conto_visione',
      'conto_lavorazione',
      'reso',
      'tentata_vendita',
      'campionatura',
      'altro',
    ],
    default: 'vendita',
  })
  causaleTrasporto: DdtCausale;

  /** Carrier UUID (optional; null if customer collects). */
  @Column({ type: 'uuid', nullable: true })
  carrierId: string | null;

  /** Carrier-side tracking number once the shipment is created. */
  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  trackingNumber: string | null;

  /** Total package count + weight (informational; carrier confirms). */
  @Column({ type: 'int', default: 1 })
  packageCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  totalWeightKg: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  shipFromAddress: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  shipToAddress: Record<string, unknown>;

  /** Optional reference to the invoice that bundled this DDT. */
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @OneToMany(() => DdtLine, (l) => l.ddt, { cascade: ['insert', 'update'] })
  lines: DdtLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('ddt_lines')
@Index(['tenantId', 'ddtId'])
@Index(['tenantId', 'salesOrderLineId'])
export class DdtLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  ddtId: string;

  @Column({ type: 'uuid' })
  productId: string;

  /** Optional originating sales-order-line for traceability. */
  @Column({ type: 'uuid', nullable: true })
  salesOrderLineId: string | null;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  quantity: string;

  @Column({ length: 20, default: 'pz' })
  unitOfMeasure: string;

  /** Per-piece serials when the product is serialised. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  serialIds: string[];

  /** Optional lot id for batch-tracked products. */
  @Column({ type: 'uuid', nullable: true })
  lotId: string | null;

  @ManyToOne(() => Ddt, (d) => d.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ddtId' })
  ddt: Ddt;
}
