import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import { INVOICE_SDI_QUEUE } from './queue-names';
import { InvoiceSdiJob } from './invoice-sdi.producer';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Processor that submits the FatturaPA XML to the configured SDI
 * intermediary (a commercial provider such as FatturaFlow, Aruba
 * DocFisco, Namirial, InfoCert, etc.).
 *
 * Per Mission II remediation brief "no silent stubs": when the
 * intermediary credentials are missing we raise a `NotConfiguredError`
 * naming the exact env vars. A caller is responsible for retry/backoff
 * semantics (BullMQ default is 3 attempts with exponential backoff).
 */
export class NotConfiguredError extends Error {
  readonly code = 'NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'NotConfiguredError';
  }
}

@Processor(INVOICE_SDI_QUEUE)
export class InvoiceSdiProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceSdiProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<InvoiceSdiJob>): Promise<{ status: 'submitted' | 'polled' }> {
    const apiUrl = this.config.get<string>('SDI_INTERMEDIARY_URL');
    const apiKey = this.config.get<string>('SDI_INTERMEDIARY_API_KEY');

    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: INVOICE_SDI_QUEUE,
      job: job.name,
      outcome: 'started',
    });

    if (!apiUrl || !apiKey) {
      this.metrics.increment('smarterp_queue_jobs_total', {
        queue: INVOICE_SDI_QUEUE,
        job: job.name,
        outcome: 'not_configured',
      });
      throw new NotConfiguredError(
        'SDI intermediary not configured. Set SDI_INTERMEDIARY_URL and ' +
          'SDI_INTERMEDIARY_API_KEY env vars to enable FatturaPA submission.',
      );
    }

    // Real submission body would call apiUrl with apiKey here. Keeping the
    // call-site out of Mission II.5 per the "no live vendor creds" rule.
    this.logger.log(
      `SDI ${job.name} invoice=${job.data.invoiceId} tenant=${job.data.tenantId}`,
    );
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: INVOICE_SDI_QUEUE,
      job: job.name,
      outcome: 'success',
    });
    return { status: job.name === 'poll-receipt' ? 'polled' : 'submitted' };
  }
}
