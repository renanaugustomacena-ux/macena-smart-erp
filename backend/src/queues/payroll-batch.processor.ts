import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PAYROLL_BATCH_QUEUE } from './queue-names';
import { PayrollBatchJob } from './payroll-batch.producer';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Processor for the payroll-batch queue.
 *
 * The real CCNL-aware computation is deferred to the future TeamFlow
 * integration (v2.0 §20.8 "INPS / INAIL: payroll-adjacent interfaces exposed
 * for future TeamFlow integration"). Until TeamFlow ships, this processor
 * intentionally raises a typed stub error so a job enqueued in production
 * fails loudly rather than silently reporting success.
 */
@Processor(PAYROLL_BATCH_QUEUE)
export class PayrollBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollBatchProcessor.name);

  constructor(private readonly metrics: MetricsService) {
    super();
  }

  async process(job: Job<PayrollBatchJob>): Promise<{ status: 'stub' }> {
    this.logger.log(
      `payroll-batch job=${job.name} id=${job.id} tenant=${job.data.tenantId} period=${job.data.period}`,
    );
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: PAYROLL_BATCH_QUEUE,
      job: job.name,
      outcome: 'started',
    });

    // Fail-closed: TeamFlow integration required.
    const err = new Error(
      'PayrollBatchProcessor is a stub pending TeamFlow integration (v2.0 §20.8). ' +
        'Configure TEAMFLOW_API_URL and TEAMFLOW_API_KEY and implement the live branch.',
    );
    (err as Error & { code?: string }).code = 'NOT_CONFIGURED';
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: PAYROLL_BATCH_QUEUE,
      job: job.name,
      outcome: 'stub_failure',
    });
    throw err;
  }
}
