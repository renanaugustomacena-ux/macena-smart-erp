import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

/**
 * Cash forecast (plan §31.2 Sprint 32).
 *
 * v1 ships a deterministic 30-/60-/90-day cash projection from the
 * tenant's open invoices (AR) + supplier invoices (AP). Treasury
 * reconciliation engine + auto-matching heuristic land in the same
 * sprint (`AutoReconciler`).
 */
export interface CashForecastBucket {
  horizonDays: 30 | 60 | 90;
  arInflowCents: number;
  apOutflowCents: number;
  netCents: number;
  arCount: number;
  apCount: number;
}

@Injectable()
export class CashForecastService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async forecast(tenantId: string): Promise<CashForecastBucket[]> {
    const now = Date.now();
    const buckets = ([30, 60, 90] as const).map((horizonDays) => ({
      horizonDays,
      arInflowCents: 0,
      apOutflowCents: 0,
      netCents: 0,
      arCount: 0,
      apCount: 0,
    }));

    const invoices = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere(
        "i.status NOT IN ('paid', 'cancelled')",
      )
      .getMany();
    for (const inv of invoices) {
      const dueAt = new Date(inv.invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000;
      const days = Math.max(0, Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000)));
      const cents = Math.round(Number(inv.totalAmount ?? 0) * 100);
      for (const b of buckets) {
        if (days <= b.horizonDays) {
          b.arInflowCents += cents;
          b.arCount += 1;
        }
      }
    }

    const sis = await this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId })
      .andWhere("si.status NOT IN ('paid','cancelled','rejected')")
      .getMany();
    for (const si of sis) {
      const dueAt = new Date(si.paymentDueDate).getTime();
      const days = Math.max(0, Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000)));
      const cents = Number(si.totalCents ?? 0);
      for (const b of buckets) {
        if (days <= b.horizonDays) {
          b.apOutflowCents += cents;
          b.apCount += 1;
        }
      }
    }

    for (const b of buckets) b.netCents = b.arInflowCents - b.apOutflowCents;
    return buckets;
  }
}
