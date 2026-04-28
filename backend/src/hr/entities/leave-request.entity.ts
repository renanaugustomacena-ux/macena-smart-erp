import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../common/data-classification.decorator';

/**
 * LeaveRequest — domanda di ferie / permesso / malattia
 * (plan §31.1 Sprint 17 / S17.3).
 *
 * `leaveType` covers the v1 set drawn from CCNL Metalmeccanico Industria
 * + CCNL Commercio Terziario as the two reference contracts. Additional
 * types (e.g., `congedo_donazione_sangue`, `sciopero`) are aliasable
 * via `tags` (jsonb) without a schema change.
 *
 * Italian regulatory anchors:
 *   - D.Lgs. 151/2001 — congedo maternità / paternità / parentale.
 *   - L. 53/2000 — congedo per gravi motivi familiari.
 *   - L. 104/1992 — permessi assistenza disabili.
 *
 * State machine (R-D07):
 *   draft       → submitted
 *   submitted   → approved | rejected
 *   draft       → cancelled
 *   submitted   → cancelled       (employee withdraws)
 *   approved    → cancelled       (e.g., employee returns early — manager triggers)
 *   approved, rejected, cancelled — terminal
 */
export type LeaveStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type LeaveType =
  | 'ferie'
  | 'permesso_retribuito'
  | 'permesso_non_retribuito'
  | 'malattia'
  | 'congedo_maternita'
  | 'congedo_paternita'
  | 'congedo_parentale'
  | 'congedo_matrimoniale'
  | 'lutto'
  | 'l104'
  | 'altro';

@Entity('leave_requests')
@Index(['tenantId', 'employeeId', 'startDate'])
@Index(['tenantId', 'status', 'startDate'])
@Index(['tenantId', 'leaveType', 'startDate'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({
    type: 'enum',
    enum: [
      'ferie',
      'permesso_retribuito',
      'permesso_non_retribuito',
      'malattia',
      'congedo_maternita',
      'congedo_paternita',
      'congedo_parentale',
      'congedo_matrimoniale',
      'lutto',
      'l104',
      'altro',
    ],
  })
  leaveType: LeaveType;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  /** Decimal days requested (0.5 for half-day). */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  daysRequested: string;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  reason: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
    default: 'draft',
  })
  status: LeaveStatus;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  decisionReason: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  /** Optional path to a supporting document (medical certificate, etc.). */
  @Column({ length: 500, nullable: true })
  @DataClassification('confidential')
  attachmentPath: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
