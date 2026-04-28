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
 * Approval-chain entry. Stored as an item in the `approverChain` JSONB
 * column on PurchaseRequisition (one entry per required approver).
 */
export interface ApprovalStep {
  userId: string;
  role: 'manager' | 'admin' | 'founder';
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string; // ISO 8601
  rejectedAt?: string;
  comment?: string;
}

/**
 * PurchaseRequisition state machine (R-D07; plan §9.6.1):
 *   DRAFT → SUBMITTED → APPROVED | REJECTED | CANCELLED
 *   APPROVED → CONVERTED (to PO) | CANCELLED
 *   REJECTED is terminal except CANCELLED on cleanup.
 */
export type PurchaseRequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'cancelled';

@Entity('purchase_requisitions')
@Index(['tenantId', 'requisitionNumber'], { unique: true })
@Index(['tenantId', 'status', 'createdAt'])
export class PurchaseRequisition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  requisitionNumber: string;

  @Column()
  @DataClassification('confidential')
  requestedBy: string;

  @Column({ type: 'date' })
  requestedDate: Date;

  @Column({ type: 'date', nullable: true })
  needByDate: Date | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled'],
    default: 'draft',
  })
  status: PurchaseRequisitionStatus;

  /**
   * Approval chain. Composed at submit-time per the tenant's per-amount
   * approval policy (manager / admin / founder, see ProcurementService).
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  @DataClassification('confidential')
  approverChain: ApprovalStep[];

  @Column({ type: 'bigint', default: 0 })
  totalEstimateCents: number;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  /** Set when status transitions to CONVERTED — the resulting PO id. */
  @Column({ type: 'uuid', nullable: true })
  convertedToPurchaseOrderId: string | null;

  @OneToMany(() => PurchaseRequisitionLine, (line) => line.requisition, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  lines: PurchaseRequisitionLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_requisition_lines')
@Index(['tenantId', 'requisitionId'])
export class PurchaseRequisitionLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  requisitionId: string;

  @Column()
  productId: string;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  quantity: string; // numeric → string in TypeORM PG driver to preserve precision

  @Column({ length: 20, default: 'pz' })
  unitOfMeasure: string;

  @Column({ type: 'bigint', default: 0 })
  estimatedUnitCostCents: number;

  @Column({ type: 'uuid', nullable: true })
  preferredSupplierId: string | null;

  @Column({ type: 'date', nullable: true })
  needByDate: Date | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @ManyToOne(() => PurchaseRequisition, (req) => req.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requisitionId' })
  requisition: PurchaseRequisition;
}
