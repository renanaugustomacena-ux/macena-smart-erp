import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { INVOICE_SDI_QUEUE, InvoiceSdiJobName } from './queue-names';

export interface InvoiceSdiJob {
  tenantId: string;
  invoiceId: string;
  attempt?: number;
}

/**
 * Producer for the invoice → SDI async submission. The AccountingService
 * `queueInvoiceForSdi` controller action dispatches a job here rather than
 * calling the SDI intermediary inline, so the HTTP request returns fast.
 */
@Injectable()
export class InvoiceSdiProducer {
  private readonly logger = new Logger(InvoiceSdiProducer.name);

  constructor(@InjectQueue(INVOICE_SDI_QUEUE) private readonly queue: Queue) {}

  async enqueueSubmit(job: InvoiceSdiJob): Promise<string> {
    const name: InvoiceSdiJobName = 'submit';
    const rec = await this.queue.add(name, job, {
      jobId: `sdi-submit:${job.tenantId}:${job.invoiceId}`,
    });
    this.logger.log(
      `Enqueued SDI submission invoice=${job.invoiceId} tenant=${job.tenantId} jobId=${rec.id}`,
    );
    return rec.id ?? '';
  }

  async enqueuePoll(job: InvoiceSdiJob): Promise<string> {
    const name: InvoiceSdiJobName = 'poll-receipt';
    const rec = await this.queue.add(name, job, {
      jobId: `sdi-poll:${job.tenantId}:${job.invoiceId}:${Date.now()}`,
      delay: 5 * 60 * 1000, // 5 min
    });
    return rec.id ?? '';
  }
}
