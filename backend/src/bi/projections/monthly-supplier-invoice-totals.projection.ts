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
 * monthly_supplier_invoice_totals — purchase totals per fiscal month
 * per tenant. Key = `YYYY-MM`. Payload = { count, subtotalCents,
 * taxCents, totalCents }.
 */
@Injectable()
export class MonthlySupplierInvoiceTotalsProjection implements Projection {
  readonly id = 'monthly_supplier_invoice_totals';
  readonly description =
    'Purchase totals per fiscal month: SI count + subtotal + IVA + total.';
  readonly source = 'supplier_invoices' as const;

  constructor(
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp) {
      qb.andWhere('si.supplierInvoiceDate >= :from', {
        from: ctx.fromTimestamp,
      });
    }
    if (ctx.toTimestamp) {
      qb.andWhere('si.supplierInvoiceDate < :to', { to: ctx.toTimestamp });
    }
    const rows = await qb.getMany();
    const buckets = new Map<
      string,
      { count: number; subtotalCents: number; taxCents: number; totalCents: number }
    >();
    for (const r of rows) {
      const d = new Date(r.supplierInvoiceDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = buckets.get(key) ?? {
        count: 0,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
      };
      cur.count += 1;
      cur.subtotalCents += Number(r.subtotalCents ?? 0);
      cur.taxCents += Number(r.taxCents ?? 0);
      cur.totalCents += Number(r.totalCents ?? 0);
      buckets.set(key, cur);
    }
    return {
      rows: Array.from(buckets.entries())
        .map(([key, payload]) => ({ key, payload }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
