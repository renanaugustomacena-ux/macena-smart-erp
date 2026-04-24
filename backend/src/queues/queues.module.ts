import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetricsModule } from '../metrics/metrics.module';

import { PayrollBatchProducer } from './payroll-batch.producer';
import { PayrollBatchProcessor } from './payroll-batch.processor';
import { EndOfDayProducer } from './end-of-day.producer';
import { EndOfDayProcessor } from './end-of-day.processor';
import { ReportGenerationProducer } from './report-generation.producer';
import { ReportGenerationProcessor } from './report-generation.processor';
import {
  PAYROLL_BATCH_QUEUE,
  END_OF_DAY_QUEUE,
  REPORT_GENERATION_QUEUE,
  INVOICE_SDI_QUEUE,
} from './queue-names';
import { InvoiceSdiProducer } from './invoice-sdi.producer';
import { InvoiceSdiProcessor } from './invoice-sdi.processor';

/**
 * Queues module — wires every BullMQ queue used by SmartERP.
 *
 * Queues declared per v2.0 spec Section 20.3 ("Background jobs: BullMQ —
 * payroll-calculation batches, end-of-day postings, report generation") plus
 * an `invoice-sdi` queue that drives the async FatturaPA submission loop.
 *
 * Redis connection is shared with the cache module. If `REDIS_HOST` is not
 * configured the BullModule still boots but consumers log a degraded-mode
 * warning — v2.0 §10 requires the service to stay up under Redis outage.
 */
@Global()
@Module({
  imports: [
    MetricsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          // Allow queue workers to survive transient Redis blips.
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400, count: 5000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: PAYROLL_BATCH_QUEUE },
      { name: END_OF_DAY_QUEUE },
      { name: REPORT_GENERATION_QUEUE },
      { name: INVOICE_SDI_QUEUE },
    ),
  ],
  providers: [
    PayrollBatchProducer,
    PayrollBatchProcessor,
    EndOfDayProducer,
    EndOfDayProcessor,
    ReportGenerationProducer,
    ReportGenerationProcessor,
    InvoiceSdiProducer,
    InvoiceSdiProcessor,
  ],
  exports: [
    BullModule,
    PayrollBatchProducer,
    EndOfDayProducer,
    ReportGenerationProducer,
    InvoiceSdiProducer,
  ],
})
export class QueuesModule {}
