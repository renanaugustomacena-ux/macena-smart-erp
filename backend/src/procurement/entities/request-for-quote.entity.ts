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
 * RequestForQuote (RFQ) state machine (R-D07; plan §9.6.1).
 *
 *   DRAFT → SENT → QUOTES_RECEIVED → AWARDED → CONVERTED
 *   CANCELLED reachable from any non-terminal state.
 *   EXPIRED reachable from SENT or QUOTES_RECEIVED on validity expiry.
 */
export type RequestForQuoteStatus =
  | 'draft'
  | 'sent'
  | 'quotes_received'
  | 'awarded'
  | 'converted'
  | 'expired'
  | 'cancelled';

@Entity('request_for_quotes')
@Index(['tenantId', 'rfqNumber'], { unique: true })
@Index(['tenantId', 'status', 'validUntilDate'])
export class RequestForQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  rfqNumber: string;

  @Column()
  requesterId: string;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date' })
  validUntilDate: Date;

  @Column({
    type: 'enum',
    enum: [
      'draft',
      'sent',
      'quotes_received',
      'awarded',
      'converted',
      'expired',
      'cancelled',
    ],
    default: 'draft',
  })
  status: RequestForQuoteStatus;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  awardedQuoteId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  awardedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  convertedToPurchaseOrderId: string | null;

  @OneToMany(() => RequestForQuoteLine, (l) => l.rfq, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  lines: RequestForQuoteLine[];

  @OneToMany(() => RequestForQuoteQuote, (q) => q.rfq, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  quotes: RequestForQuoteQuote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('request_for_quote_lines')
@Index(['tenantId', 'rfqId'])
export class RequestForQuoteLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  rfqId: string;

  @Column()
  productId: string;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  quantity: string;

  @Column({ length: 20, default: 'pz' })
  unitOfMeasure: string;

  @Column({ type: 'date', nullable: true })
  needByDate: Date | null;

  @ManyToOne(() => RequestForQuote, (rfq) => rfq.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfqId' })
  rfq: RequestForQuote;
}

/**
 * One row per supplier solicitation. When a supplier responds with a
 * quote, status transitions PENDING → RECEIVED, and totalCents +
 * perLineUnitCostsCents are populated. The award step picks one row
 * (sets `awardedQuoteId` on the parent RFQ).
 */
export type RequestForQuoteQuoteStatus = 'pending' | 'received' | 'declined';

@Entity('request_for_quote_quotes')
@Index(['tenantId', 'rfqId', 'supplierId'], { unique: true })
export class RequestForQuoteQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  rfqId: string;

  @Column()
  supplierId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'received', 'declined'],
    default: 'pending',
  })
  status: RequestForQuoteQuoteStatus;

  @Column({ type: 'bigint', nullable: true })
  totalCents: number | null;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  validUntilDate: Date | null;

  /** [{rfqLineId, unitCostCents, leadTimeDays?}, ...] */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  @DataClassification('confidential')
  perLineCosts: Array<{
    rfqLineId: string;
    unitCostCents: number;
    leadTimeDays?: number;
  }>;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @ManyToOne(() => RequestForQuote, (rfq) => rfq.quotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfqId' })
  rfq: RequestForQuote;
}
