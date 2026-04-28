import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { Invoice } from '../../accounting/accounting.entity';

/**
 * customer_revenue_ranking — per-customer YTD revenue (top-N table feed).
 * Key = customerId. Payload = { name, count, totalCents, lastInvoiceAt }.
 */
@Injectable()
export class CustomerRevenueRankingProjection implements Projection {
  readonly id = 'customer_revenue_ranking';
  readonly description =
    'Per-customer YTD revenue: invoice count + total (cents) + last-invoice timestamp.';
  readonly source = 'invoices' as const;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('i.invoiceDate >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp)
      qb.andWhere('i.invoiceDate < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<
      string,
      { name: string; count: number; totalCents: number; lastInvoiceAt: string }
    >();
    for (const r of rows) {
      const cur = m.get(r.customerId) ?? {
        name: r.customerName,
        count: 0,
        totalCents: 0,
        lastInvoiceAt: '',
      };
      cur.count += 1;
      cur.totalCents += Math.round(Number(r.totalAmount ?? 0) * 100);
      const at = new Date(r.invoiceDate).toISOString();
      if (!cur.lastInvoiceAt || at > cur.lastInvoiceAt) cur.lastInvoiceAt = at;
      m.set(r.customerId, cur);
    }
    return {
      rows: Array.from(m.entries())
        .map(([key, payload]) => ({ key, payload }))
        .sort(
          (a, b) =>
            (b.payload.totalCents as number) - (a.payload.totalCents as number),
        ),
    };
  }
}
