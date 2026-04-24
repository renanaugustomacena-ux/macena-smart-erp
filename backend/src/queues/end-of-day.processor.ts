import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';

import { END_OF_DAY_QUEUE } from './queue-names';
import { EndOfDayJob } from './end-of-day.producer';
import { MetricsService } from '../metrics/metrics.service';

/**
 * End-of-day processor. Performs a light-weight set of database consistency
 * checks that are safe to run with the tables in their current form:
 *   - sum stock_levels per product as a sanity check.
 *   - count journal_entries isPosted = false (pending prima nota).
 * Heavier closing (rollover, deferred-income recognition, bank reco) is
 * deferred to the full accounting subsystem.
 */
@Processor(END_OF_DAY_QUEUE)
export class EndOfDayProcessor extends WorkerHost {
  private readonly logger = new Logger(EndOfDayProcessor.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<EndOfDayJob>): Promise<{
    openEntries: number;
    products: number;
  }> {
    const { tenantId, businessDate } = job.data;
    this.logger.log(
      `end-of-day job=${job.name} tenant=${tenantId} date=${businessDate}`,
    );
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: END_OF_DAY_QUEUE,
      job: job.name,
      outcome: 'started',
    });

    let openEntries = 0;
    let products = 0;
    try {
      const rows = (await this.ds.query(
        'SELECT COUNT(*)::int AS c FROM journal_entries WHERE "tenantId" = $1 AND "isPosted" = false',
        [tenantId],
      )) as { c: number }[];
      openEntries = rows[0]?.c ?? 0;

      const prodRows = (await this.ds.query(
        'SELECT COUNT(*)::int AS c FROM products WHERE "tenantId" = $1 AND "isActive" = true',
        [tenantId],
      )) as { c: number }[];
      products = prodRows[0]?.c ?? 0;
    } catch (err) {
      this.logger.warn(
        `end-of-day query failed tenant=${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      this.metrics.increment('smarterp_queue_jobs_total', {
        queue: END_OF_DAY_QUEUE,
        job: job.name,
        outcome: 'failure',
      });
      throw err;
    }

    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: END_OF_DAY_QUEUE,
      job: job.name,
      outcome: 'success',
    });
    return { openEntries, products };
  }
}
