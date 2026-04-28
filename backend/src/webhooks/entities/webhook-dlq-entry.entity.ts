import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * WebhookDlqEntry — one row per event that exhausted retry attempts
 * (ADR-037).
 *
 * Operators (or, behind a feature flag, tenants themselves) can replay
 * a DLQ row through `POST /api/webhooks/dlq/{id}/replay` — the row gets
 * re-enqueued with attempt counter reset to 1.
 *
 * Default TTL is 30 days; the sweep job lives in plan §31.2 Sprint 24.
 */
@Entity('webhook_dlq_entries')
@Index(['tenantId', 'subscriptionId', 'createdAt'])
@Index(['tenantId', 'eventType', 'createdAt'])
export class WebhookDlqEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'uuid' })
  outboxEventId: string;

  @Column({ length: 200 })
  eventType: string;

  @Column({ type: 'int' })
  totalAttempts: number;

  /** Last attempt's outcome — for quick triage. */
  @Column({ length: 32 })
  lastOutcome: string;

  /** Last attempt's HTTP status if any. */
  @Column({ type: 'int', nullable: true })
  lastHttpStatus: number | null;

  /** Truncated to 2000 chars. */
  @Column({ type: 'text', nullable: true })
  lastErrorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  replayedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replayedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
