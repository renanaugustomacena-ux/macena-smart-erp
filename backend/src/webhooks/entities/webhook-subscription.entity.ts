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
 * WebhookSubscription — per-tenant per-event-type subscription
 * (ADR-037; plan §31.1 Sprint 14 S14.6).
 *
 * `hmacSecret` is encrypted at rest per ADR-DA07; the column carries
 * ciphertext, not plaintext. Plaintext is held in memory only at sign
 * time, never logged.
 */
export type WebhookSubscriptionStatus = 'active' | 'paused' | 'disabled';

@Entity('webhook_subscriptions')
@Index(['tenantId', 'eventType', 'status'])
@Index(['tenantId', 'status'])
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  /**
   * Canonical CloudEvents 1.0 `type` value, e.g.
   * `it.smarterp.procurement.gr_confirmed.v1`.
   */
  @Column({ length: 200 })
  eventType: string;

  /** HTTPS URL the consumer will receive deliveries at. */
  @Column({ length: 1000 })
  @DataClassification('confidential')
  targetUrl: string;

  /**
   * Encrypted-at-rest HMAC secret. The signer pulls and decrypts via the
   * field-level encryption service (ADR-DA07) at sign time. Never logged.
   */
  @Column({ length: 4000 })
  @DataClassification('restricted')
  hmacSecret: string;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'disabled'],
    default: 'active',
  })
  status: WebhookSubscriptionStatus;

  /**
   * RFC 3339 reason text — populated when status flips to `disabled`
   * either by storm-trip (DLQ rolling-window threshold) or by an
   * explicit consumer 410-Gone / 404-Not Found.
   */
  @Column({ type: 'text', nullable: true })
  disabledReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
