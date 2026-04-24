import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { END_OF_DAY_QUEUE, EndOfDayJobName } from './queue-names';

export interface EndOfDayJob {
  tenantId: string;
  businessDate: string; // YYYY-MM-DD
  triggeredBy: string;
}

/**
 * Producer for `end-of-day`. v2.0 §20.3 lists "end-of-day postings" as a
 * spec-mandated BullMQ workload. A real implementation would run at 23:59
 * Europe/Rome, but Mission II.5 wires the queue and enqueue path only.
 */
@Injectable()
export class EndOfDayProducer {
  private readonly logger = new Logger(EndOfDayProducer.name);

  constructor(@InjectQueue(END_OF_DAY_QUEUE) private readonly queue: Queue) {}

  async enqueueCloseDay(job: EndOfDayJob): Promise<string> {
    const name: EndOfDayJobName = 'close-day';
    const rec = await this.queue.add(name, job, {
      jobId: `eod:${job.tenantId}:${job.businessDate}`,
    });
    this.logger.log(
      `Enqueued end-of-day tenant=${job.tenantId} date=${job.businessDate} jobId=${rec.id}`,
    );
    return rec.id ?? '';
  }

  async enqueueStockReconciliation(job: EndOfDayJob): Promise<string> {
    const name: EndOfDayJobName = 'reconcile-stock';
    const rec = await this.queue.add(name, job, {
      jobId: `eod-stock:${job.tenantId}:${job.businessDate}`,
    });
    return rec.id ?? '';
  }
}
