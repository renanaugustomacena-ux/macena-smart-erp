import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PAYROLL_BATCH_QUEUE, PayrollBatchJobName } from './queue-names';

export interface PayrollBatchJob {
  tenantId: string;
  period: string; // YYYY-MM
  includeThirteenth?: boolean;
  triggeredBy: string; // userId
}

/**
 * Producer for the `payroll-batch` queue. Emits one job per tenant per
 * period; the processor performs the actual CCNL-aware calculation.
 *
 * Not yet wired to a user-facing controller — the `/api/v1/payroll-adjacent`
 * surface area is intentionally kept minimal until TeamFlow integration
 * lands (v2.0 Section 20.8). The producer can be called directly from a
 * cron-scheduled nest job or from operator tooling.
 */
@Injectable()
export class PayrollBatchProducer {
  private readonly logger = new Logger(PayrollBatchProducer.name);

  constructor(
    @InjectQueue(PAYROLL_BATCH_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueMonthly(job: PayrollBatchJob): Promise<string> {
    const name: PayrollBatchJobName = job.includeThirteenth
      ? 'compute-thirteenth'
      : 'compute-monthly';
    const jobRecord = await this.queue.add(name, job, {
      jobId: `payroll:${job.tenantId}:${job.period}:${name}`,
    });
    this.logger.log(
      `Enqueued ${name} payroll batch tenant=${job.tenantId} period=${job.period} jobId=${jobRecord.id}`,
    );
    return jobRecord.id ?? '';
  }
}
