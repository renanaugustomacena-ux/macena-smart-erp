import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Audit log entry.
 *
 * Closes gap B-10: persistent audit table with who / what / when / from /
 * to / correlation_id per v2.0 §12 + §20.9. Rows are written by the
 * `AuditInterceptor` on every non-GET request and on every successful
 * `auth.login` / `auth.logout` event.
 *
 * RLS: included in the `EnableRowLevelSecurity` migration — a tenant
 * cannot read another tenant's audit trail at the DB level.
 */
@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['correlationId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  tenantId: string | null;

  @Column({ nullable: true })
  userId: string | null;

  @Column({ length: 255, nullable: true })
  actorEmail: string | null;

  /** Verb: `user.login`, `invoice.create`, `invoice.queue_sdi`, etc. */
  @Column({ length: 100 })
  action: string;

  @Column({ length: 100, nullable: true })
  resourceType: string | null;

  @Column({ length: 100, nullable: true })
  resourceId: string | null;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ length: 500, nullable: true })
  userAgent: string | null;

  @Column({ length: 100, nullable: true })
  correlationId: string | null;

  /** Optional before/after diff or DTO snapshot. */
  @Column({ type: 'jsonb', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ length: 20, default: 'success' })
  outcome: 'success' | 'failure' | 'denied';

  @CreateDateColumn()
  createdAt: Date;
}
