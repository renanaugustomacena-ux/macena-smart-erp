import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { REPORT_GENERATION_QUEUE, ReportJobName } from './queue-names';

export interface ReportGenerationJob {
  tenantId: string;
  reportType: ReportJobName;
  parameters: Record<string, unknown>;
  triggeredBy: string;
  requestedAt: string;
}

@Injectable()
export class ReportGenerationProducer {
  private readonly logger = new Logger(ReportGenerationProducer.name);

  constructor(
    @InjectQueue(REPORT_GENERATION_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(job: ReportGenerationJob): Promise<string> {
    const rec = await this.queue.add(job.reportType, job, {
      jobId: `report:${job.tenantId}:${job.reportType}:${job.requestedAt}`,
    });
    this.logger.log(
      `Enqueued report=${job.reportType} tenant=${job.tenantId} jobId=${rec.id}`,
    );
    return rec.id ?? '';
  }
}
