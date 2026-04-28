import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookOutboxEvent } from './entities/webhook-outbox-event.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { WebhookDlqEntry } from './entities/webhook-dlq-entry.entity';
import { HmacSigner } from './hmac-signer';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

/**
 * WebhooksModule — per ADR-037.
 *
 * Sprint 14 ships the entities + the pure-logic primitives (signer,
 * retry policy, dispatcher). Sprint 21 adds the REST management
 * surface (subscriptions CRUD + DLQ list). The live BullMQ worker
 * lands in plan §31.2 Sprint 24.
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
  controllers: [WebhooksController],
  providers: [HmacSigner, WebhooksService],
  exports: [HmacSigner, WebhooksService, TypeOrmModule],
})
export class WebhooksModule {}
