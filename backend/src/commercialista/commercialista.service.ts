import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../memberships/membership.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { IntrastatDeclaration } from '../intrastat/entities/intrastat-declaration.entity';
import { Quotation } from '../sales/entities/quotation.entity';

/**
 * CommercialistaService — read-only multi-tenant cockpit for a
 * commercialista (Andrea Portal, plan §31.1 Sprint 16 / S16.3).
 *
 * The commercialista logs in with their own user identity and consumes:
 *   - GET /api/commercialista/tenants — list of client tenants where the
 *     calling user holds an `active` membership with role=commercialista.
 *   - GET /api/commercialista/tenants/:tenantId/snapshot — aggregated
 *     per-tenant cards: invoice/supplier-invoice counts by status, the
 *     last few Intrastat declarations, pipeline summary, next IVA period.
 *
 * Authorisation: the calling user MUST hold a `commercialista` membership
 * with status='active' for the requested tenant. The service refuses
 * any other authorisation path (an admin cannot pretend to be the
 * commercialista of a tenant they don't have a row for).
 */
@Injectable()
export class CommercialistaService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SupplierInvoice)
    private readonly supplierInvoiceRepo: Repository<SupplierInvoice>,
    @InjectRepository(IntrastatDeclaration)
    private readonly intrastatRepo: Repository<IntrastatDeclaration>,
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
  ) {}

  async listAssignedTenants(userId: string): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      plan: Tenant['plan'];
      status: Tenant['status'];
      grantedAt: Date | null;
      role: Membership['role'];
    }>
  > {
    // The commercialista is identified by userId (a global UUID); a
    // tenantId predicate would be wrong here because the answer ranges
    // over all tenants the user is granted into.
    // eslint-disable-next-line no-untenanted-query
    const memberships = await this.membershipRepo.find({
      where: { userId, status: 'active', role: 'commercialista' },
      order: { grantedAt: 'DESC' },
    });
    if (memberships.length === 0) return [];

    const tenantIds = memberships.map((m) => m.tenantId);
    // Tenant lookup keyed by the explicit id list returned above.
    // eslint-disable-next-line no-untenanted-query
    const tenants = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids: tenantIds })
      .getMany();
    const tenantsById = new Map(tenants.map((t) => [t.id, t]));

    return memberships
      .map((m) => {
        const t = tenantsById.get(m.tenantId);
        if (!t) return null;
        return {
          tenantId: t.id,
          tenantName: t.name,
          plan: t.plan,
          status: t.status,
          grantedAt: m.grantedAt,
          role: m.role,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async getSnapshot(
    userId: string,
    tenantId: string,
  ): Promise<{
    tenant: { id: string; name: string; plan: Tenant['plan']; status: Tenant['status'] };
    invoiceStatusCounts: Record<string, number>;
    supplierInvoiceStatusCounts: Record<string, number>;
    ivaPeriod: { totalSalesCents: number; totalPurchasesCents: number; balanceCents: number };
    recentIntrastat: Array<{
      id: string;
      type: IntrastatDeclaration['type'];
      periodYear: number;
      periodMonth: number | null;
      status: IntrastatDeclaration['status'];
      lineCount: number;
      totalValueCents: number;
    }>;
    pipelineQuotationCounts: Record<string, number>;
    deadlines: Array<{ kind: string; dueDate: string; description: string }>;
  }> {
    await this.assertCommercialistaMembership(userId, tenantId);

    const tenant = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.id = :id', { id: tenantId })
      .getOne();
    if (!tenant) throw new NotFoundException('Tenant not found');

    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [invoiceRows, supplierInvoiceRows, intrastatRows, quotationRows] =
      await Promise.all([
        this.invoiceRepo
          .createQueryBuilder('i')
          .where('i.tenantId = :tenantId', { tenantId })
          .andWhere('i.invoiceDate >= :from', { from: yearStart })
          .getMany(),
        this.supplierInvoiceRepo
          .createQueryBuilder('si')
          .where('si.tenantId = :tenantId', { tenantId })
          .andWhere('si.supplierInvoiceDate >= :from', { from: yearStart })
          .getMany(),
        this.intrastatRepo
          .createQueryBuilder('d')
          .where('d.tenantId = :tenantId', { tenantId })
          .orderBy('d.periodYear', 'DESC')
          .addOrderBy('d.periodMonth', 'DESC')
          .limit(5)
          .getMany(),
        this.quotationRepo
          .createQueryBuilder('q')
          .where('q.tenantId = :tenantId', { tenantId })
          .andWhere('q.issueDate >= :from', { from: yearStart })
          .getMany(),
      ]);

    const invoiceStatusCounts = countByField(invoiceRows, 'status');
    const supplierInvoiceStatusCounts = countByField(
      supplierInvoiceRows,
      'status',
    );
    const pipelineQuotationCounts = countByField(quotationRows, 'status');

    // IVA balance for current month (sales total tax - purchases total tax).
    const monthSalesTaxCents = invoiceRows
      .filter(
        (r) =>
          new Date(r.invoiceDate).getTime() >= monthStart.getTime() &&
          new Date(r.invoiceDate).getTime() < monthEnd.getTime(),
      )
      .reduce((acc, r) => acc + Math.round(Number(r.taxAmount ?? 0) * 100), 0);
    const monthPurchaseTaxCents = supplierInvoiceRows
      .filter(
        (r) =>
          new Date(r.supplierInvoiceDate).getTime() >= monthStart.getTime() &&
          new Date(r.supplierInvoiceDate).getTime() < monthEnd.getTime(),
      )
      .reduce((acc, r) => acc + Number(r.taxCents ?? 0), 0);

    const recentIntrastat = intrastatRows.map((d) => ({
      id: d.id,
      type: d.type,
      periodYear: d.periodYear,
      periodMonth: d.periodMonth,
      status: d.status,
      lineCount: d.lineCount,
      totalValueCents: Number(d.totalValueCents),
    }));

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
      },
      invoiceStatusCounts,
      supplierInvoiceStatusCounts,
      ivaPeriod: {
        totalSalesCents: monthSalesTaxCents,
        totalPurchasesCents: monthPurchaseTaxCents,
        balanceCents: monthSalesTaxCents - monthPurchaseTaxCents,
      },
      recentIntrastat,
      pipelineQuotationCounts,
      deadlines: nextDeadlines(now),
    };
  }

  // ─── Private ────────────────────────────────────────────────

  private async assertCommercialistaMembership(
    userId: string,
    tenantId: string,
  ): Promise<Membership> {
    const m = await this.membershipRepo.findOne({
      where: { tenantId, userId, role: 'commercialista' },
    });
    if (!m) {
      throw new ForbiddenException(
        'No active commercialista membership for the requested tenant',
      );
    }
    if (m.status !== 'active') {
      throw new ForbiddenException(
        `Commercialista membership is not active (status='${m.status}')`,
      );
    }
    return m;
  }
}

function countByField<T>(rows: T[], field: keyof T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = (r as Record<string, unknown>)[field as string];
    const k = String(v ?? '_');
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Italian periodic IVA deadlines (DPR 322/1998 + Provv. AE):
 *   - Mensile: 16th of the following month
 *   - Trimestrale: 16th of the second month after the quarter
 *   - LIPE (annual summary): July
 *
 * For v1 we surface only the mensile deadline (the most common case for
 * SMEs). Quarterly is added in S17 alongside the CCNL data model.
 */
function nextDeadlines(
  now: Date,
): Array<{ kind: string; dueDate: string; description: string }> {
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 16),
  );
  return [
    {
      kind: 'iva_mensile',
      dueDate: nextMonthStart.toISOString().slice(0, 10),
      description:
        'Liquidazione IVA mensile — versamento entro il 16 del mese successivo (DPR 322/1998 art. 8)',
    },
  ];
}
