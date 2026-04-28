import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookOutboxEvent } from './entities/webhook-outbox-event.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { WebhookDlqEntry } from './entities/webhook-dlq-entry.entity';
import { HmacSigner } from './hmac-signer';

/**
 * WebhooksModule — per ADR-037.
 *
 * Sprint 14 ships the entities + the pure-logic primitives (signer,
 * retry policy, dispatcher). The live worker, REST API, and BullMQ
 * wiring land in plan §31.2 Sprint 24.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookSubscription,
      WebhookOutboxEvent,
      WebhookDeliveryAttempt,
      WebhookDlqEntry,
    ]),
  ],
  providers: [HmacSigner],
  exports: [HmacSigner, TypeOrmModule],
})
export class WebhooksModule {}
