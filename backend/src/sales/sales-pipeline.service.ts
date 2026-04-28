import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Quotation,
  type QuotationStatus,
} from './entities/quotation.entity';
import { ContactActivity } from './entities/contact-activity.entity';
import { Ddt } from './entities/ddt.entity';
import { Customer, SalesOrder, SalesOrderStatus } from './sales.entity';

/**
 * SalesPipelineService — read-side projection feeding the pipeline screen
 * (plan §31.1 Sprint 16 / S16.1).
 *
 * The service is intentionally a synchronous query layer on top of the
 * existing entities (Quotation, SalesOrder, Ddt, ContactActivity) — no
 * materialised view, no event-sourced read model. Plan §31.2 Sprint 18
 * promotes the pipeline projection into a CQRS read model when filter
 * latency exceeds the 200 ms p95 budget; until then the live aggregation
 * is good enough for the largest expected v1 tenant (~5k customers,
 * ~50k quotations).
 *
 * Stage mapping (per §9.7 sales-pipeline doctrine):
 *   - lead          → customer has activities but no quotation in window
 *   - qualifying    → latest quotation in {draft, sent}
 *   - negotiation   → latest quotation in {revised}
 *   - won           → latest quotation in {accepted, converted} AND any
 *                     linked SalesOrder is not yet fully shipped
 *   - delivered     → linked SalesOrder in {shipped, invoiced}
 *   - lost          → latest quotation in {rejected, expired} within 90 d
 *
 * All queries carry an explicit `tenantId` predicate to satisfy
 * doctrine R-D02 (no-untenanted-query) and use `tenantId`-prefixed
 * indexes per R-D01.
 */

export type PipelineStage =
  | 'lead'
  | 'qualifying'
  | 'negotiation'
  | 'won'
  | 'delivered'
  | 'lost';

export interface PipelineDeal {
  customerId: string;
  customerCode: string;
  customerName: string;
  stage: PipelineStage;
  quotationId: string | null;
  quotationNumber: string | null;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  valueCents: number;
  currency: string;
  status: QuotationStatus | SalesOrderStatus | 'lead' | null;
  issueDate: string | null;
  lastActivityAt: string | null;
  ageDays: number;
}

export interface PipelineFilters {
  stage?: PipelineStage[];
  customerId?: string;
  customerCodeContains?: string;
  periodFrom?: string;
  periodTo?: string;
  minValueCents?: number;
  maxValueCents?: number;
  ownerId?: string;
  currency?: string;
}

export interface PipelineSnapshot {
  asOf: string;
  totalsByStage: Record<PipelineStage, { count: number; valueCents: number }>;
  deals: PipelineDeal[];
}

export interface CustomerTimelineEvent {
  occurredAt: string;
  kind:
    | 'quotation_created'
    | 'quotation_sent'
    | 'quotation_revised'
    | 'quotation_accepted'
    | 'quotation_rejected'
    | 'quotation_expired'
    | 'quotation_converted'
    | 'sales_order_created'
    | 'ddt_issued'
    | 'ddt_in_transit'
    | 'ddt_delivered'
    | 'ddt_returned'
    | 'ddt_invoiced'
    | 'activity';
  reference: string;
  summary: string;
  valueCents: number | null;
  currency: string | null;
  linkedEntityId: string;
  linkedEntityType:
    | 'quotation'
    | 'sales_order'
    | 'ddt'
    | 'contact_activity';
  recordedById?: string | null;
}

const LOST_LOOKBACK_DAYS = 90;
const LEAD_ACTIVITY_LOOKBACK_DAYS = 90;

@Injectable()
export class SalesPipelineService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Ddt)
    private readonly ddtRepo: Repository<Ddt>,
    @InjectRepository(ContactActivity)
    private readonly activityRepo: Repository<ContactActivity>,
  ) {}

  // ─── Pipeline snapshot (S16.1) ────────────────────────────────

  async getPipeline(
    tenantId: string,
    filters: PipelineFilters = {},
  ): Promise<PipelineSnapshot> {
    const deals: PipelineDeal[] = [];

    // 1. Latest quotation per customer.
    const quotationQb = this.quotationRepo
      .createQueryBuilder('q')
      .where('q.tenantId = :tenantId', { tenantId });

    if (filters.customerId) {
      quotationQb.andWhere('q.customerId = :customerId', {
        customerId: filters.customerId,
      });
    }
    if (filters.periodFrom) {
      quotationQb.andWhere('q.issueDate >= :periodFrom', {
        periodFrom: filters.periodFrom,
      });
    }
    if (filters.periodTo) {
      quotationQb.andWhere('q.issueDate <= :periodTo', {
        periodTo: filters.periodTo,
      });
    }
    if (filters.minValueCents !== undefined) {
      quotationQb.andWhere('q.totalCents >= :minValueCents', {
        minValueCents: filters.minValueCents,
      });
    }
    if (filters.maxValueCents !== undefined) {
      quotationQb.andWhere('q.totalCents <= :maxValueCents', {
        maxValueCents: filters.maxValueCents,
      });
    }
    if (filters.currency) {
      quotationQb.andWhere('q.currency = :currency', {
        currency: filters.currency,
      });
    }
    quotationQb.orderBy('q.customerId', 'ASC').addOrderBy('q.issueDate', 'DESC');
    const quotations = await quotationQb.getMany();

    const latestQuotationByCustomer = new Map<string, Quotation>();
    for (const q of quotations) {
      if (!latestQuotationByCustomer.has(q.customerId)) {
        latestQuotationByCustomer.set(q.customerId, q);
      }
    }

    const customerIds = new Set<string>(latestQuotationByCustomer.keys());

    // 2. Customers with activities but no quotation → potential leads.
    const sinceLead = new Date(
      Date.now() - LEAD_ACTIVITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const recentActivities = await this.activityRepo
      .createQueryBuilder('a')
      .select('a.customerId', 'customerId')
      .addSelect('MAX(a.occurredAt)', 'lastActivityAt')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.occurredAt >= :since', { since: sinceLead })
      .groupBy('a.customerId')
      .getRawMany<{ customerId: string; lastActivityAt: Date | string }>();

    const lastActivityByCustomer = new Map<string, Date>();
    for (const r of recentActivities) {
      const at =
        typeof r.lastActivityAt === 'string'
          ? new Date(r.lastActivityAt)
          : r.lastActivityAt;
      lastActivityByCustomer.set(r.customerId, at);
      customerIds.add(r.customerId);
    }

    if (customerIds.size === 0) {
      return this.emptySnapshot();
    }

    // 3. Bulk-load Customer rows for label resolution.
    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.id IN (:...ids)', { ids: Array.from(customerIds) })
      .getMany();

    const customerById = new Map<string, Customer>(
      customers.map((c) => [c.id, c]),
    );

    // 4. Latest converted SalesOrder per customer (when linked from quotation).
    const convertedQuotationSoIds = quotations
      .filter((q) => q.convertedToSalesOrderId)
      .map((q) => q.convertedToSalesOrderId as string);
    let salesOrderById = new Map<string, SalesOrder>();
    if (convertedQuotationSoIds.length > 0) {
      const sos = await this.salesOrderRepo
        .createQueryBuilder('so')
        .where('so.tenantId = :tenantId', { tenantId })
        .andWhere('so.id IN (:...ids)', { ids: convertedQuotationSoIds })
        .getMany();
      salesOrderById = new Map(sos.map((so) => [so.id, so]));
    }

    // 5. Compose per-customer deal.
    const now = Date.now();
    const lostCutoff = new Date(
      now - LOST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const customerId of customerIds) {
      const customer = customerById.get(customerId);
      if (!customer) continue; // safety: customer may have been hard-deleted
      if (
        filters.customerCodeContains &&
        !customer.code
          .toLowerCase()
          .includes(filters.customerCodeContains.toLowerCase())
      ) {
        continue;
      }

      const q = latestQuotationByCustomer.get(customerId);
      const lastAct = lastActivityByCustomer.get(customerId) ?? null;

      const deal = this.composeDeal({
        customer,
        quotation: q ?? null,
        salesOrder: q?.convertedToSalesOrderId
          ? (salesOrderById.get(q.convertedToSalesOrderId) ?? null)
          : null,
        lastActivityAt: lastAct,
        nowMs: now,
        lostCutoff,
      });
      if (!deal) continue;

      if (
        filters.minValueCents !== undefined &&
        deal.valueCents < filters.minValueCents
      ) {
        continue;
      }
      if (
        filters.maxValueCents !== undefined &&
        deal.valueCents > filters.maxValueCents
      ) {
        continue;
      }
      if (filters.currency && deal.currency !== filters.currency) continue;
      if (filters.stage && filters.stage.length > 0 && !filters.stage.includes(deal.stage)) {
        continue;
      }

      deals.push(deal);
    }

    // 6. Sort: most recent activity first, ties broken by largest value.
    deals.sort((a, b) => {
      const aT = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
      const bT = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
      if (aT !== bT) return bT - aT;
      return b.valueCents - a.valueCents;
    });

    // 7. Totals by stage.
    const totalsByStage: PipelineSnapshot['totalsByStage'] = {
      lead: { count: 0, valueCents: 0 },
      qualifying: { count: 0, valueCents: 0 },
      negotiation: { count: 0, valueCents: 0 },
      won: { count: 0, valueCents: 0 },
      delivered: { count: 0, valueCents: 0 },
      lost: { count: 0, valueCents: 0 },
    };
    for (const d of deals) {
      totalsByStage[d.stage].count += 1;
      totalsByStage[d.stage].valueCents += d.valueCents;
    }

    return {
      asOf: new Date().toISOString(),
      totalsByStage,
      deals,
    };
  }

  private emptySnapshot(): PipelineSnapshot {
    return {
      asOf: new Date().toISOString(),
      totalsByStage: {
        lead: { count: 0, valueCents: 0 },
        qualifying: { count: 0, valueCents: 0 },
        negotiation: { count: 0, valueCents: 0 },
        won: { count: 0, valueCents: 0 },
        delivered: { count: 0, valueCents: 0 },
        lost: { count: 0, valueCents: 0 },
      },
      deals: [],
    };
  }

  private composeDeal(args: {
    customer: Customer;
    quotation: Quotation | null;
    salesOrder: SalesOrder | null;
    lastActivityAt: Date | null;
    nowMs: number;
    lostCutoff: Date;
  }): PipelineDeal | null {
    const { customer, quotation: q, salesOrder, lastActivityAt, nowMs, lostCutoff } = args;

    // Determine stage + value.
    let stage: PipelineStage;
    let valueCents = 0;
    let currency = 'EUR';
    let issueDate: string | null = null;
    let status: PipelineDeal['status'] = null;
    let quotationId: string | null = null;
    let quotationNumber: string | null = null;
    let salesOrderId: string | null = null;
    let salesOrderNumber: string | null = null;

    if (!q) {
      // Pure lead.
      if (!lastActivityAt) return null;
      stage = 'lead';
      status = 'lead';
    } else {
      quotationId = q.id;
      quotationNumber = q.quotationNumber;
      currency = q.currency;
      // bigint columns come back as strings from pg; coerce defensively.
      valueCents = Number(q.totalCents);
      issueDate = formatDateOnly(q.issueDate);
      status = q.status;

      switch (q.status) {
        case 'draft':
        case 'sent':
          stage = 'qualifying';
          break;
        case 'revised':
          stage = 'negotiation';
          break;
        case 'accepted':
          stage = 'won';
          break;
        case 'converted':
          if (salesOrder) {
            salesOrderId = salesOrder.id;
            salesOrderNumber = salesOrder.orderNumber;
            if (
              salesOrder.status === SalesOrderStatus.SHIPPED ||
              salesOrder.status === SalesOrderStatus.INVOICED
            ) {
              stage = 'delivered';
              status = salesOrder.status;
            } else {
              stage = 'won';
            }
          } else {
            stage = 'won';
          }
          break;
        case 'rejected':
        case 'expired': {
          // Suppress old lost deals beyond LOST_LOOKBACK_DAYS.
          const updated = q.updatedAt ?? q.issueDate;
          const updatedTs =
            updated instanceof Date ? updated.getTime() : Date.parse(String(updated));
          if (Number.isFinite(updatedTs) && updatedTs < lostCutoff.getTime()) {
            return null;
          }
          stage = 'lost';
          break;
        }
        default:
          stage = 'qualifying';
      }
    }

    const ageReference =
      lastActivityAt ??
      (q?.updatedAt instanceof Date ? q.updatedAt : null) ??
      (q?.createdAt instanceof Date ? q.createdAt : null);
    const ageDays = ageReference
      ? Math.floor((nowMs - ageReference.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      stage,
      quotationId,
      quotationNumber,
      salesOrderId,
      salesOrderNumber,
      valueCents,
      currency,
      status,
      issueDate,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      ageDays,
    };
  }

  // ─── Per-customer drill-down (S16.1) ──────────────────────────

  async getCustomerTimeline(
    tenantId: string,
    customerId: string,
  ): Promise<{ customerId: string; events: CustomerTimelineEvent[] }> {
    const events: CustomerTimelineEvent[] = [];

    const quotationsQb = this.quotationRepo
      .createQueryBuilder('q')
      .where('q.tenantId = :tenantId', { tenantId })
      .andWhere('q.customerId = :customerId', { customerId });
    const quotations = await quotationsQb.getMany();

    for (const q of quotations) {
      events.push({
        occurredAt: toIso(q.createdAt) ?? toIso(q.issueDate) ?? new Date(0).toISOString(),
        kind: 'quotation_created',
        reference: q.quotationNumber,
        summary: `Preventivo ${q.quotationNumber} creato`,
        valueCents: Number(q.totalCents),
        currency: q.currency,
        linkedEntityId: q.id,
        linkedEntityType: 'quotation',
      });
      if (q.sentAt) {
        events.push({
          occurredAt: toIso(q.sentAt) as string,
          kind: 'quotation_sent',
          reference: q.quotationNumber,
          summary: `Preventivo ${q.quotationNumber} inviato`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
      if (q.status === 'revised') {
        events.push({
          occurredAt: toIso(q.updatedAt) as string,
          kind: 'quotation_revised',
          reference: q.quotationNumber,
          summary: `Preventivo ${q.quotationNumber} revisionato`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
      if (q.acceptedAt) {
        events.push({
          occurredAt: toIso(q.acceptedAt) as string,
          kind: 'quotation_accepted',
          reference: q.quotationNumber,
          summary: `Preventivo ${q.quotationNumber} accettato`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
      if (q.rejectedAt) {
        events.push({
          occurredAt: toIso(q.rejectedAt) as string,
          kind: 'quotation_rejected',
          reference: q.quotationNumber,
          summary: q.rejectionReason
            ? `Preventivo ${q.quotationNumber} rifiutato: ${q.rejectionReason}`
            : `Preventivo ${q.quotationNumber} rifiutato`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
      if (q.status === 'expired') {
        events.push({
          occurredAt: toIso(q.updatedAt) as string,
          kind: 'quotation_expired',
          reference: q.quotationNumber,
          summary: `Preventivo ${q.quotationNumber} scaduto`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
      if (q.convertedToSalesOrderId) {
        events.push({
          occurredAt: toIso(q.updatedAt) as string,
          kind: 'quotation_converted',
          reference: q.quotationNumber,
          summary: `Preventivo ${q.quotationNumber} convertito in ordine`,
          valueCents: Number(q.totalCents),
          currency: q.currency,
          linkedEntityId: q.id,
          linkedEntityType: 'quotation',
        });
      }
    }

    const salesOrders = await this.salesOrderRepo
      .createQueryBuilder('so')
      .where('so.tenantId = :tenantId', { tenantId })
      .andWhere('so.customerId = :customerId', { customerId })
      .getMany();

    for (const so of salesOrders) {
      events.push({
        occurredAt: toIso(so.createdAt) as string,
        kind: 'sales_order_created',
        reference: so.orderNumber,
        summary: `Ordine cliente ${so.orderNumber} creato`,
        valueCents: Math.round(Number(so.totalAmount) * 100),
        currency: 'EUR',
        linkedEntityId: so.id,
        linkedEntityType: 'sales_order',
      });
    }

    const ddts = await this.ddtRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.customerId = :customerId', { customerId })
      .getMany();

    for (const d of ddts) {
      if (d.status !== 'draft') {
        // The entity stores the legal issue date (date-only); we surface
        // it as midnight Europe/Rome to keep the timeline ordered.
        const issueIso = formatDateOnly(d.issueDate);
        if (issueIso) {
          events.push({
            occurredAt: new Date(`${issueIso}T00:00:00Z`).toISOString(),
            kind: 'ddt_issued',
            reference: d.ddtNumber,
            summary: `DDT ${d.ddtNumber} emesso`,
            valueCents: null,
            currency: null,
            linkedEntityId: d.id,
            linkedEntityType: 'ddt',
          });
        }
      }
      if (d.shippedAt) {
        events.push({
          occurredAt: toIso(d.shippedAt) as string,
          kind: 'ddt_in_transit',
          reference: d.ddtNumber,
          summary: `DDT ${d.ddtNumber} in transito`,
          valueCents: null,
          currency: null,
          linkedEntityId: d.id,
          linkedEntityType: 'ddt',
        });
      }
      if (d.deliveredAt) {
        events.push({
          occurredAt: toIso(d.deliveredAt) as string,
          kind: 'ddt_delivered',
          reference: d.ddtNumber,
          summary: `DDT ${d.ddtNumber} consegnato`,
          valueCents: null,
          currency: null,
          linkedEntityId: d.id,
          linkedEntityType: 'ddt',
        });
      }
      if (d.invoiceId) {
        events.push({
          occurredAt: toIso(d.updatedAt) as string,
          kind: 'ddt_invoiced',
          reference: d.ddtNumber,
          summary: `DDT ${d.ddtNumber} fatturato`,
          valueCents: null,
          currency: null,
          linkedEntityId: d.id,
          linkedEntityType: 'ddt',
        });
      }
    }

    const activities = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.customerId = :customerId', { customerId })
      .getMany();

    for (const a of activities) {
      events.push({
        occurredAt: toIso(a.occurredAt) as string,
        kind: 'activity',
        reference: a.subject,
        summary: a.subject,
        valueCents: null,
        currency: null,
        linkedEntityId: a.id,
        linkedEntityType: 'contact_activity',
        recordedById: a.recordedBy ?? null,
      });
    }

    events.sort((x, y) => Date.parse(y.occurredAt) - Date.parse(x.occurredAt));

    return { customerId, events };
  }
}

function formatDateOnly(d: Date | string | null): string | null {
  if (d === null || d === undefined) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const ts = Date.parse(d);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  return d.toISOString();
}

