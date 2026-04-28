import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

/**
 * ConsolidationService — Phase B of multi-company support
 * (plan §31.2 Sprint 34).
 *
 * Aggregates per-Company KPIs into tenant-level totals. v1 covers:
 *   - Per-Company sales total (cents) for the requested fiscal year.
 *   - Per-Company purchase total (cents) for the requested fiscal year.
 *   - Tenant-level rollup (sum across companies).
 *
 * Eliminations between companies (intercompany transactions) are
 * out-of-scope for v1 — flagged for Sprint 35 alongside the SOC 2
 * audit prep.
 */
export interface ConsolidationLine {
  companyId: string;
  companyCode: string;
  companyName: string;
  salesCents: number;
  purchasesCents: number;
  netCents: number;
}

export interface ConsolidationResult {
  fiscalYear: number;
  perCompany: ConsolidationLine[];
  rollup: {
    salesCents: number;
    purchasesCents: number;
    netCents: number;
  };
  computedAtIso: string;
}

@Injectable()
export class ConsolidationService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async consolidate(
    tenantId: string,
    fiscalYear: number,
  ): Promise<ConsolidationResult> {
    const companies = await this.companyRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.isActive = true')
      .getMany();

    // v1: companyId column on document tables lands in M-028 (deferred);
    // the consolidation falls back to per-VAT-number partitioning so a
    // tenant with N companies can still see a meaningful breakdown
    // when the documents carry the company VAT in `customerVatNumber`
    // / supplier-side metadata. When a document has no resolvable
    // company, it accumulates into the primary company.
    const fromDate = new Date(`${fiscalYear}-01-01`);
    const toDate = new Date(`${fiscalYear + 1}-01-01`);

    const invoices = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere('i.invoiceDate >= :from', { from: fromDate })
      .andWhere('i.invoiceDate < :to', { to: toDate })
      .getMany();
    const supplierInvoices = await this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId })
      .andWhere('si.supplierInvoiceDate >= :from', { from: fromDate })
      .andWhere('si.supplierInvoiceDate < :to', { to: toDate })
      .getMany();

    const primary =
      companies.find((c) => c.isPrimary) ?? companies[0] ?? null;
    const lines: Map<string, ConsolidationLine> = new Map();
    for (const c of companies) {
      lines.set(c.id, {
        companyId: c.id,
        companyCode: c.code,
        companyName: c.name,
        salesCents: 0,
        purchasesCents: 0,
        netCents: 0,
      });
    }

    for (const inv of invoices) {
      const company =
        companies.find((c) => c.vatNumber && c.vatNumber === inv.customerVatNumber)
          ?? primary;
      if (!company) continue;
      const line = lines.get(company.id);
      if (!line) continue;
      line.salesCents += Math.round(Number(inv.totalAmount ?? 0) * 100);
    }
    for (const si of supplierInvoices) {
      // supplier-side VAT not stored on the SI row in v1 schema; use primary.
      const target = primary ? lines.get(primary.id) : null;
      if (!target) continue;
      target.purchasesCents += Number(si.totalCents ?? 0);
    }

    let rollupSales = 0;
    let rollupPurchases = 0;
    for (const line of lines.values()) {
      line.netCents = line.salesCents - line.purchasesCents;
      rollupSales += line.salesCents;
      rollupPurchases += line.purchasesCents;
    }

    return {
      fiscalYear,
      perCompany: Array.from(lines.values()).sort((a, b) =>
        a.companyCode.localeCompare(b.companyCode),
      ),
      rollup: {
        salesCents: rollupSales,
        purchasesCents: rollupPurchases,
        netCents: rollupSales - rollupPurchases,
      },
      computedAtIso: new Date().toISOString(),
    };
  }
}
