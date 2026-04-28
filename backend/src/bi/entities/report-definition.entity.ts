import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * ReportDefinition — saved custom report configuration
 * (plan §31.1 Sprint 18 / S18.3).
 *
 * `body` is a tenant-defined JSON spec describing widgets + filters +
 * grouping. The spec format is intentionally flexible (no schema yet)
 * so the report builder UI can iterate quickly. v2 may pin a JSON
 * Schema for it; v1 keeps it as a typed `Record<string, unknown>`.
 */
@Entity('report_definitions')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'createdBy'])
export class ReportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'jsonb' })
  body: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * ReportSchedule — cron-based scheduled delivery (plan §31.1 Sprint 18 / S18.6).
 */
export type ReportScheduleStatus =
  | 'active'
  | 'paused'
  | 'failed'
  | 'cancelled';
export type ReportScheduleChannel = 'email' | 'pec';
export type ReportScheduleFormat = 'pdf' | 'xlsx' | 'csv';

@Entity('report_schedules')
@Index(['tenantId', 'reportDefinitionId'])
@Index(['tenantId', 'status', 'nextRunAt'])
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  reportDefinitionId: string;

  /** Cron expression (UTC); 5-field standard. */
  @Column({ length: 50 })
  cronExpression: string;

  @Column({ length: 5 })
  timezone: string;

  @Column({
    type: 'enum',
    enum: ['email', 'pec'],
    default: 'email',
  })
  channel: ReportScheduleChannel;

  /** Delivery destinations (one or more email/PEC addresses). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  recipients: string[];

  @Column({
    type: 'enum',
    enum: ['pdf', 'xlsx', 'csv'],
    default: 'pdf',
  })
  format: ReportScheduleFormat;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'failed', 'cancelled'],
    default: 'active',
  })
  status: ReportScheduleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
