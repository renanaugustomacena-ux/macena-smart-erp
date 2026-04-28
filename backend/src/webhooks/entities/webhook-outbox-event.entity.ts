import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * WebhookOutboxEvent — transactional outbox row inserted in the same DB
 * transaction as the domain change (ADR-037).
 *
 * The dispatcher polls this table, fans-out to matching subscriptions,
 * records per-attempt rows in `webhook_delivery_attempts`, and on
 * exhaustion lands a `webhook_dlq_entries` row.
 *
 * `dispatchedAt` is set the first moment the dispatcher pulls the row;
 * `completedAt` is set when every active subscription has either
 * delivered (2xx) or trip-DLQ'd. The row stays for archival up to the
 * retention TTL (separate sweep job; default 30 days).
 */
@Entity('webhook_outbox_events')
@Index(['tenantId', 'completedAt'])
@Index(['tenantId', 'eventType', 'createdAt'])
export class WebhookOutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  /** Canonical CloudEvents 1.0 `type`. */
  @Column({ length: 200 })
  eventType: string;

  /** CloudEvents 1.0 `source` URI. */
  @Column({ length: 500 })
  source: string;

  /**
   * CloudEvents 1.0 `time` — RFC 3339 UTC. Stored separately from
   * `createdAt` to preserve the originating event time even when the
   * dispatcher queues it later.
   */
  @Column({ type: 'timestamptz' })
  eventTime: Date;

  /** CloudEvents 1.0 `data` payload. */
  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  /** When the dispatcher first picked this row. */
  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;

  /**
   * When every active matching subscription has either delivered (2xx)
   * or trip-DLQ'd. Until this is set the row remains "in-flight".
   */
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
