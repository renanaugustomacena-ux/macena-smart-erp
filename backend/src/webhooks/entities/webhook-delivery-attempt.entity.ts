import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * WebhookDeliveryAttempt — one row per HTTP delivery attempt
 * (ADR-037).
 *
 * Provides the per-attempt audit trail an operator inspects when a
 * tenant claims "we never got the event". `outcome`, `httpStatus`,
 * `durationMs`, and `errorMessage` together fingerprint each attempt.
 */
export type WebhookDeliveryOutcome =
  | 'success_2xx'
  | 'client_4xx'
  | 'server_5xx'
  | 'timeout'
  | 'connection_refused'
  | 'tls_error'
  | 'gone_410'
  | 'not_found_404'
  | 'rate_limited_429'
  | 'unknown';

@Entity('webhook_delivery_attempts')
@Index(['tenantId', 'subscriptionId', 'createdAt'])
@Index(['tenantId', 'outboxEventId'])
@Index(['tenantId', 'outcome', 'createdAt'])
export class WebhookDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'uuid' })
  outboxEventId: string;

  @Column({ type: 'int' })
  attemptNumber: number;

  @Column({
    type: 'enum',
    enum: [
      'success_2xx',
      'client_4xx',
      'server_5xx',
      'timeout',
      'connection_refused',
      'tls_error',
      'gone_410',
      'not_found_404',
      'rate_limited_429',
      'unknown',
    ],
  })
  outcome: WebhookDeliveryOutcome;

  @Column({ type: 'int', nullable: true })
  httpStatus: number | null;

  @Column({ type: 'int' })
  durationMs: number;

  /** Truncated to 2000 chars; sensitive content is filtered upstream. */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /** Per-attempt UUID — surfaced as the `X-SmartERP-Delivery-Id` header. */
  @Column({ type: 'uuid' })
  deliveryId: string;

  @CreateDateColumn()
  createdAt: Date;
}
