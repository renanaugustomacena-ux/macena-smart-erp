import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsModule } from '../metrics/metrics.module';
import { PEC_INGEST_QUEUE } from '../queues/queue-names';
import { ImapPecMailbox } from './imap-pec-mailbox';
import { PecIngestService } from './pec-ingest.service';
import { PecIngestProducer } from './pec-ingest.producer';
import { PecIngestProcessor } from './pec-ingest.processor';

/**
 * PecModule — per Sprint 14 / S14.4 (skeleton).
 *
 * Hosts the FatturaPA passive-cycle ingester: PecMailbox port + IMAP
 * skeleton + parser + ingest service + BullMQ producer/processor.
 *
 * Live wiring (Sprint 24):
 *   - Replace ImapPecMailbox with the live `imapflow`-based impl.
 *   - Wire the processor's downstream call to
 *     ProcurementService.createSupplierInvoice via a thin orchestrator.
 *   - Schedule per-tenant repeatable poll on tenant onboarding.
 */
@Module({
  imports: [
    MetricsModule,
    BullModule.registerQueue({ name: PEC_INGEST_QUEUE }),
  ],
  providers: [
    ImapPecMailbox,
    PecIngestService,
    PecIngestProducer,
    PecIngestProcessor,
  ],
  exports: [PecIngestService, PecIngestProducer],
})
export class PecModule {}
