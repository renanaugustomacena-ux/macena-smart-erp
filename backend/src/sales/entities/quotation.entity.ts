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
 * Quotation (Preventivo) — pre-sales document offering price + terms to a
 * customer (R-D07; plan §31.1 Sprint 15 / S15.1).
 *
 * State machine:
 *   DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED
 *   SENT → REVISED → SENT (loop while customer renegotiates)
 *   ACCEPTED → CONVERTED (to a SalesOrder)
 *   CONVERTED, REJECTED, EXPIRED — terminal.
 *
 * Per Italian B2B practice, a quotation does not by itself trigger any
 * fiscal posting — those happen at SalesOrder confirmation + DDT issue +
 * Invoice issue. The platform tracks the offer for the CRM cycle and to
 * justify discounts at audit time.
 */
export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'revised'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

@Entity('quotations')
@Index(['tenantId', 'quotationNumber'], { unique: true })
@Index(['tenantId', 'status', 'issueDate'])
@Index(['tenantId', 'customerId', 'issueDate'])
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  quotationNumber: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date' })
  validUntilDate: Date;

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'revised', 'accepted', 'rejected', 'expired', 'converted'],
    default: 'draft',
  })
  status: QuotationStatus;

  @Column({ type: 'bigint', default: 0 })
  subtotalCents: number;

  @Column({ type: 'bigint', default: 0 })
  taxCents: number;

  @Column({ type: 'bigint', default: 0 })
  totalCents: number;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  /** Free-form internal note + customer-visible note (split client-side). */
  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  convertedToSalesOrderId: string | null;

  @OneToMany(() => QuotationLine, (l) => l.quotation, {
    cascade: ['insert', 'update'],
  })
  lines: QuotationLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('quotation_lines')
@Index(['tenantId', 'quotationId'])
export class QuotationLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  quotationId: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  quantity: string;

  @Column({ length: 20, default: 'pz' })
  unitOfMeasure: string;

  @Column({ type: 'bigint', default: 0 })
  unitPriceCents: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discountPct: string;

  @Column({ type: 'int', default: 22 })
  taxRate: number;

  @Column({ type: 'bigint', default: 0 })
  lineTotalCents: number;

  @ManyToOne(() => Quotation, (q) => q.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotationId' })
  quotation: Quotation;
}
