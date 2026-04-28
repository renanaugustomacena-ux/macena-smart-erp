import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { Quotation } from '../../sales/entities/quotation.entity';

/**
 * quotation_pipeline_summary — quotation status counters + value.
 * Key = quotation.status. Payload = { count, totalCents, avgCents }.
 */
@Injectable()
export class QuotationPipelineSummaryProjection implements Projection {
  readonly id = 'quotation_pipeline_summary';
  readonly description =
    'Quotation pipeline summary: count + total cents + average per status.';
  readonly source = 'sales_orders' as const;

  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.quotationRepo
      .createQueryBuilder('q')
      .where('q.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('q.issueDate >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp)
      qb.andWhere('q.issueDate < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<string, { count: number; totalCents: number }>();
    for (const r of rows) {
      const cur = m.get(r.status) ?? { count: 0, totalCents: 0 };
      cur.count += 1;
      cur.totalCents += Number(r.totalCents ?? 0);
      m.set(r.status, cur);
    }
    return {
      rows: Array.from(m.entries()).map(([key, sums]) => ({
        key,
        payload: {
          count: sums.count,
          totalCents: sums.totalCents,
          avgCents:
            sums.count === 0 ? 0 : Math.round(sums.totalCents / sums.count),
        },
      })),
    };
  }
}
