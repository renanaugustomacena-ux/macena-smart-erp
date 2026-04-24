import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';

import { REPORT_GENERATION_QUEUE } from './queue-names';
import { ReportGenerationJob } from './report-generation.producer';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Report generation processor.
 *
 * Produces a simple aggregate per report type. The result is returned on the
 * job rather than persisted so downstream retrievers can subscribe to
 * `job.finished()`. A follow-up change will materialise reports to object
 * storage and expose a signed URL.
 */
@Processor(REPORT_GENERATION_QUEUE)
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<ReportGenerationJob>): Promise<Record<string, unknown>> {
    this.logger.log(
      `report job=${job.name} tenant=${job.data.tenantId} id=${job.id}`,
    );
    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: REPORT_GENERATION_QUEUE,
      job: job.name,
      outcome: 'started',
    });

    const { tenantId } = job.data;
    let result: Record<string, unknown> = {};
    try {
      switch (job.name) {
        case 'iva-liquidation': {
          const rows = (await this.ds.query(
            `SELECT COALESCE(SUM("taxAmount"), 0)::float8 AS iva,
                    COALESCE(SUM("subtotalAmount"), 0)::float8 AS taxable
             FROM invoices
             WHERE "tenantId" = $1 AND status = 'accepted'`,
            [tenantId],
          )) as { iva: number; taxable: number }[];
          result = { iva: rows[0]?.iva ?? 0, taxable: rows[0]?.taxable ?? 0 };
          break;
        }
        case 'sales-by-customer': {
          const rows = (await this.ds.query(
            `SELECT "customerId", COUNT(*)::int AS orders,
                    COALESCE(SUM("totalAmount"), 0)::float8 AS revenue
             FROM sales_orders
             WHERE "tenantId" = $1
             GROUP BY "customerId"
             ORDER BY revenue DESC
             LIMIT 50`,
            [tenantId],
          )) as Array<{ customerId: string; orders: number; revenue: number }>;
          result = { rows };
          break;
        }
        case 'stock-status': {
          const rows = (await this.ds.query(
            `SELECT COUNT(*)::int AS levels,
                    COALESCE(SUM("quantityOnHand"), 0)::float8 AS onHand,
                    COALESCE(SUM("quantityReserved"), 0)::float8 AS reserved
             FROM stock_levels WHERE "tenantId" = $1`,
            [tenantId],
          )) as { levels: number; onHand: number; reserved: number }[];
          result = rows[0] ?? { levels: 0, onHand: 0, reserved: 0 };
          break;
        }
        default:
          throw new Error(`Unknown report type: ${job.name}`);
      }
    } catch (err) {
      this.metrics.increment('smarterp_queue_jobs_total', {
        queue: REPORT_GENERATION_QUEUE,
        job: job.name,
        outcome: 'failure',
      });
      throw err;
    }

    this.metrics.increment('smarterp_queue_jobs_total', {
      queue: REPORT_GENERATION_QUEUE,
      job: job.name,
      outcome: 'success',
    });
    return result;
  }
}
