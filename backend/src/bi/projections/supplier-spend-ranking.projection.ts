import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { SupplierInvoice } from '../../procurement/entities/supplier-invoice.entity';

/**
 * supplier_spend_ranking — per-supplier YTD spend.
 * Key = supplierId. Payload = { count, totalCents, lastInvoiceAt }.
 */
@Injectable()
export class SupplierSpendRankingProjection implements Projection {
  readonly id = 'supplier_spend_ranking';
  readonly description =
    'Per-supplier YTD spend: invoice count + total (cents) + last-invoice timestamp.';
  readonly source = 'supplier_invoices' as const;

  constructor(
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('si.supplierInvoiceDate >= :from', {
        from: ctx.fromTimestamp,
      });
    if (ctx.toTimestamp)
      qb.andWhere('si.supplierInvoiceDate < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<
      string,
      { count: number; totalCents: number; lastInvoiceAt: string }
    >();
    for (const r of rows) {
      const cur = m.get(r.supplierId) ?? {
        count: 0,
        totalCents: 0,
        lastInvoiceAt: '',
      };
      cur.count += 1;
      cur.totalCents += Number(r.totalCents ?? 0);
      const at = new Date(r.supplierInvoiceDate).toISOString();
      if (!cur.lastInvoiceAt || at > cur.lastInvoiceAt) cur.lastInvoiceAt = at;
      m.set(r.supplierId, cur);
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
