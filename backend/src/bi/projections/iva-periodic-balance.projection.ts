import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { Invoice } from '../../accounting/accounting.entity';
import { SupplierInvoice } from '../../procurement/entities/supplier-invoice.entity';

/**
 * iva_periodic_balance — IVA mensile balance per fiscal period.
 * Key = `YYYY-MM`. Payload = { ivaSalesCents, ivaPurchasesCents,
 * balanceCents }.
 */
@Injectable()
export class IvaPeriodicBalanceProjection implements Projection {
  readonly id = 'iva_periodic_balance';
  readonly description =
    'Monthly IVA liquidation: sales tax - purchases tax (cents).';
  readonly source = 'mixed' as const;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const invoiceQb = this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      invoiceQb.andWhere('i.invoiceDate >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp)
      invoiceQb.andWhere('i.invoiceDate < :to', { to: ctx.toTimestamp });
    const invoices = await invoiceQb.getMany();

    const siQb = this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      siQb.andWhere('si.supplierInvoiceDate >= :from', {
        from: ctx.fromTimestamp,
      });
    if (ctx.toTimestamp)
      siQb.andWhere('si.supplierInvoiceDate < :to', { to: ctx.toTimestamp });
    const sis = await siQb.getMany();

    const m = new Map<
      string,
      { ivaSalesCents: number; ivaPurchasesCents: number }
    >();
    const k = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    for (const r of invoices) {
      const key = k(new Date(r.invoiceDate));
      const cur = m.get(key) ?? { ivaSalesCents: 0, ivaPurchasesCents: 0 };
      cur.ivaSalesCents += Math.round(Number(r.taxAmount ?? 0) * 100);
      m.set(key, cur);
    }
    for (const r of sis) {
      const key = k(new Date(r.supplierInvoiceDate));
      const cur = m.get(key) ?? { ivaSalesCents: 0, ivaPurchasesCents: 0 };
      cur.ivaPurchasesCents += Number(r.taxCents ?? 0);
      m.set(key, cur);
    }
    return {
      rows: Array.from(m.entries())
        .map(([key, sums]) => ({
          key,
          payload: {
            ...sums,
            balanceCents: sums.ivaSalesCents - sums.ivaPurchasesCents,
          },
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
