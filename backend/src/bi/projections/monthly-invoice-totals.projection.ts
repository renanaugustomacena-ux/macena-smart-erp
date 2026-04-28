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
 * monthly_invoice_totals — sales totals per fiscal month per tenant.
 * Key = `YYYY-MM`. Payload = { count, subtotalCents, taxCents, totalCents }.
 */
@Injectable()
export class MonthlyInvoiceTotalsProjection implements Projection {
  readonly id = 'monthly_invoice_totals';
  readonly description =
    'Sales totals per fiscal month: invoice count + subtotal + IVA + total (R-D04 cents).';
  readonly source = 'invoices' as const;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp) {
      qb.andWhere('i.invoiceDate >= :from', { from: ctx.fromTimestamp });
    }
    if (ctx.toTimestamp) {
      qb.andWhere('i.invoiceDate < :to', { to: ctx.toTimestamp });
    }
    const rows = await qb.getMany();

    const buckets = new Map<
      string,
      { count: number; subtotalCents: number; taxCents: number; totalCents: number }
    >();
    for (const r of rows) {
      const d = new Date(r.invoiceDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = buckets.get(key) ?? {
        count: 0,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
      };
      cur.count += 1;
      cur.subtotalCents += Math.round(Number(r.subtotalAmount ?? 0) * 100);
      cur.taxCents += Math.round(Number(r.taxAmount ?? 0) * 100);
      cur.totalCents += Math.round(Number(r.totalAmount ?? 0) * 100);
      buckets.set(key, cur);
    }
    return {
      rows: Array.from(buckets.entries())
        .map(([key, payload]) => ({ key, payload }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
