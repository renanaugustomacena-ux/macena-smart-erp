import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PEC_INGEST_QUEUE } from '../queues/queue-names';
import type { PecIngestJob } from './pec-ingest.producer';
import { PecIngestService } from './pec-ingest.service';
import { ImapPecMailbox } from './imap-pec-mailbox';
import { MetricsService } from '../metrics/metrics.service';

/**
 * BullMQ worker for the per-tenant PEC mailbox poll
 * (Sprint 14 / S14.4 — skeleton; live wiring in plan §31.2 Sprint 24).
 *
 * The live worker (Sprint 24):
 *   1. Resolves the per-tenant PEC credentials from
 *      `tenant.settings.pec` (encrypted per ADR-DA07).
 *   2. Constructs an `ImapPecMailbox` for that tenant.
 *   3. Calls `pecIngestService.listFatturaPaCandidates(tenantId, mailbox)`.
 *   4. For each candidate:
 *      a. Resolves `supplier_vat_number` → `supplierId` via SuppliersService.
 *      b. Verifies `customer_vat_number` matches the tenant's VAT.
 *      c. Calls `ProcurementService.createSupplierInvoice` with the
 *         CreateSupplierInvoiceDto built from the parsed payload.
 *      d. Calls `mailbox.markSeen(pecMessageId)` to ack at the IMAP level.
 *   5. For each error, logs structured + emits a Prometheus counter.
 *
 * The skeleton processor exists so the queue boots cleanly in dev/CI.
 * It logs and metric-counts the job, then defers the live work to
 * Sprint 24 by skipping with a clear "not_configured" outcome — same
 * pattern the InvoiceSdiProcessor uses.
 */
@Processor(PEC_INGEST_QUEUE)
export class PecIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(PecIngestProcessor.name);

  constructor(
    private readonly metrics: MetricsService,
    // Kept as constructor injections so the Sprint 24 wiring is one line.
    private readonly _ingestService: PecIngestService,
    private readonly _mailbox: ImapPecMailbox,
  ) {
    super();
  }

  async process(
    job: Job<PecIngestJob>,
  ): Promise<{ status: 'skipped' | 'ingested'; candidateCount: number }> {
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: PEC_INGEST_QUEUE,
      job: job.name,
      outcome: 'started',
    });

    // Sprint 24 wiring: resolve per-tenant PEC creds, build a mailbox,
    // call this._ingestService.listFatturaPaCandidates(tenantId, mailbox),
    // map candidates to ProcurementService.createSupplierInvoice, mark
    // seen via mailbox.markSeen(...). Until that lands, the processor
    // surfaces a `skipped` outcome so it does not silently no-op.
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: PEC_INGEST_QUEUE,
      job: job.name,
      outcome: 'not_configured',
    });
    this.logger.log({
      event: 'pec.ingest_skipped',
      reason: 'live_wiring_pending_sprint_24',
      tenantId: job.data.tenantId,
    });
    return { status: 'skipped', candidateCount: 0 };
  }
}
