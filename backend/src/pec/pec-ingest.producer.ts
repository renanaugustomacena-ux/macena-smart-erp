import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PEC_INGEST_QUEUE, PecIngestJobName } from '../queues/queue-names';

export interface PecIngestJob {
  tenantId: string;
}

/**
 * Producer for the per-tenant PEC mailbox poll (Sprint 14 / S14.4).
 *
 * Each tenant gets one repeatable job at `pec-ingest:{tenantId}`. The
 * scheduling cadence is per-tenant configurable (default 5 minutes).
 *
 * The live worker (Sprint 24) hands every parsed candidate to
 * `ProcurementService.createSupplierInvoice` after resolving
 * `supplierVatNumber` → `supplierId`.
 */
@Injectable()
export class PecIngestProducer {
  private readonly logger = new Logger(PecIngestProducer.name);

  constructor(@InjectQueue(PEC_INGEST_QUEUE) private readonly queue: Queue) {}

  async enqueueOnce(job: PecIngestJob): Promise<string> {
    const name: PecIngestJobName = 'poll-mailbox';
    const rec = await this.queue.add(name, job, {
      jobId: `pec-ingest:${job.tenantId}:${Date.now()}`,
    });
    this.logger.log({
      event: 'pec.ingest_enqueued',
      tenantId: job.tenantId,
      jobId: rec.id,
    });
    return rec.id ?? '';
  }

  async scheduleRepeatable(
    tenantId: string,
    everyMs: number = 5 * 60_000,
  ): Promise<void> {
    const name: PecIngestJobName = 'poll-mailbox';
    await this.queue.add(
      name,
      { tenantId },
      {
        repeat: { every: everyMs },
        jobId: `pec-ingest-repeat:${tenantId}`,
      },
    );
    this.logger.log({
      event: 'pec.ingest_repeatable_scheduled',
      tenantId,
      everyMs,
    });
  }

  async cancelRepeatable(
    tenantId: string,
    everyMs: number = 5 * 60_000,
  ): Promise<void> {
    const name: PecIngestJobName = 'poll-mailbox';
    await this.queue.removeRepeatable(name, {
      every: everyMs,
      jobId: `pec-ingest-repeat:${tenantId}`,
    });
  }
}
