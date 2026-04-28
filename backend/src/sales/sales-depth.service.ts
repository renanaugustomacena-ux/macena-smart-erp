import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Quotation,
  QuotationLine,
  type QuotationStatus,
} from './entities/quotation.entity';
import {
  Ddt,
  DdtLine,
  type DdtStatus,
  type DdtCausale,
} from './entities/ddt.entity';
import {
  ContactActivity,
  type ContactActivityKind,
  type ContactActivityDirection,
  type ContactActivityLinkedEntityType,
} from './entities/contact-activity.entity';
import { SalesOrder, SalesOrderStatus } from './sales.entity';
import {
  canQuotationTransition,
} from './state-machines/quotation.fsm';
import { canDdtTransition } from './state-machines/ddt.fsm';
import {
  CreateQuotationDto,
  ReviseQuotationDto,
  AcceptQuotationDto,
  RejectQuotationDto,
  CreateDdtDto,
  IssueDdtDto,
  MarkInTransitDdtDto,
  MarkDeliveredDdtDto,
  CreateContactActivityDto,
  ListContactActivityQueryDto,
} from './sales-depth.dto';

/**
 * SalesDepthService — Quotations + DDTs + ContactActivity (Sprint 15
 * stories S15.1, S15.2, S15.3).
 *
 * Kept as a separate service from `SalesService` so the new entities
 * remain isolated from the legacy `SalesOrder`-driven flow until the
 * Quotation→SalesOrder + DDT→Invoice handoffs (S15.4 + S15.5) wire the
 * two sides together.
 */
@Injectable()
export class SalesDepthService {
  private readonly logger = new Logger(SalesDepthService.name);

  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationLine)
    private readonly quotationLineRepo: Repository<QuotationLine>,
    @InjectRepository(Ddt)
    private readonly ddtRepo: Repository<Ddt>,
    @InjectRepository(DdtLine)
    private readonly ddtLineRepo: Repository<DdtLine>,
    @InjectRepository(ContactActivity)
    private readonly activityRepo: Repository<ContactActivity>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Quotation (S15.1) ────────────────────────────────────────

  async createQuotation(
    tenantId: string,
    dto: CreateQuotationDto,
  ): Promise<Quotation> {
    const quotationNumber = await this.nextQuotationNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const quot = manager.create(Quotation, {
        tenantId,
        quotationNumber,
        customerId: dto.customerId,
        issueDate: new Date(dto.issueDate),
        validUntilDate: new Date(dto.validUntilDate),
        status: 'draft' as QuotationStatus,
        currency: dto.currency ?? 'EUR',
        notes: dto.notes ?? null,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        convertedToSalesOrderId: null,
      });
      const saved = await manager.save(quot);
      const lineEntities = dto.lines.map((l) => {
        const qty = Number(l.quantity);
        const unit = l.unitPriceCents;
        const discountFactor = l.discountPct ? 1 - Number(l.discountPct) / 100 : 1;
        const lineTotalCents = Math.round(qty * unit * discountFactor);
        return manager.create(QuotationLine, {
          tenantId,
          quotationId: saved.id,
          productId: l.productId ?? null,
          description: l.description,
          quantity: l.quantity,
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          unitPriceCents: l.unitPriceCents,
          discountPct: String(l.discountPct ?? 0),
          taxRate: l.taxRate ?? 22,
          lineTotalCents,
        });
      });
      await manager.save(lineEntities);
      const subtotalCents = lineEntities.reduce(
        (s, l) => s + l.lineTotalCents,
        0,
      );
      const taxCents = lineEntities.reduce(
        (s, l) => s + Math.round((l.lineTotalCents * l.taxRate) / 100),
        0,
      );
      saved.subtotalCents = subtotalCents;
      saved.taxCents = taxCents;
      saved.totalCents = subtotalCents + taxCents;
      await manager.save(saved);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'sales.quotation_created',
        tenantId,
        quotationId: saved.id,
        totalCents: saved.totalCents,
      });
      return saved;
    });
  }

  async getQuotation(tenantId: string, id: string): Promise<Quotation> {
    const q = await this.quotationRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!q) throw new NotFoundException(`Quotation ${id} not found`);
    return q;
  }

  async sendQuotation(tenantId: string, id: string): Promise<Quotation> {
    return this.transitionQuotation(tenantId, id, 'sent', (q) => {
      q.sentAt = new Date();
    });
  }

  async reviseQuotation(
    tenantId: string,
    id: string,
    dto: ReviseQuotationDto,
  ): Promise<Quotation> {
    return this.transitionQuotation(tenantId, id, 'revised', (q) => {
      q.notes = dto.note ? `${q.notes ?? ''}\n[REVISION] ${dto.note}`.trim() : q.notes;
    });
  }

  async acceptQuotation(
    tenantId: string,
    id: string,
    _dto: AcceptQuotationDto,
  ): Promise<Quotation> {
    return this.transitionQuotation(tenantId, id, 'accepted', (q) => {
      q.acceptedAt = new Date();
    });
  }

  async rejectQuotation(
    tenantId: string,
    id: string,
    dto: RejectQuotationDto,
  ): Promise<Quotation> {
    return this.transitionQuotation(tenantId, id, 'rejected', (q) => {
      q.rejectedAt = new Date();
      q.rejectionReason = dto.reason;
    });
  }

  async expireQuotation(tenantId: string, id: string): Promise<Quotation> {
    return this.transitionQuotation(tenantId, id, 'expired');
  }

  /**
   * Convert an ACCEPTED quotation into a SalesOrder (S15.4).
   *
   * Rolls the quotation into a draft SalesOrder (denormalised lines),
   * pins the SalesOrder id back onto the quotation, and transitions
   * the quotation to `converted`. Idempotent on `convertedToSalesOrderId`
   * — the second call returns the existing SalesOrder.
   */
  async convertQuotationToSalesOrder(
    tenantId: string,
    quotationId: string,
    options: { orderDate?: string } = {},
  ): Promise<SalesOrder> {
    const q = await this.getQuotation(tenantId, quotationId);
    if (q.status !== 'accepted') {
      throw new BadRequestException(
        `Cannot convert a Quotation in status ${q.status}; must be 'accepted'`,
      );
    }
    if (q.convertedToSalesOrderId) {
      const existing = await this.salesOrderRepo.findOne({
        where: { id: q.convertedToSalesOrderId, tenantId },
      });
      if (existing) return existing;
      throw new ConflictException(
        `Quotation ${quotationId} marked converted to ${q.convertedToSalesOrderId} but SalesOrder is missing`,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.nextSalesOrderNumber(tenantId);
      const lineDocs = q.lines.map((l) => ({
        productId: l.productId ?? '',
        sku: '',
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: l.unitPriceCents / 100,
        discountPct: Number(l.discountPct) || 0,
        ivaRate: l.taxRate,
        lineTotal: l.lineTotalCents / 100,
      }));
      const so = manager.create(SalesOrder, {
        tenantId,
        orderNumber,
        customerId: q.customerId,
        status: SalesOrderStatus.DRAFT,
        orderDate: options.orderDate ? new Date(options.orderDate) : new Date(),
        subtotalAmount: q.subtotalCents / 100,
        taxAmount: q.taxCents / 100,
        totalAmount: q.totalCents / 100,
        notes: q.notes ?? undefined,
        lines: lineDocs,
      } as Partial<SalesOrder>);
      const savedOrder = await manager.save(so);
      // Mark quotation converted.
      q.convertedToSalesOrderId = savedOrder.id;
      q.status = 'converted';
      await manager.save(q);
      this.logger.log({
        event: 'sales.quotation_converted',
        tenantId,
        quotationId: q.id,
        salesOrderId: savedOrder.id,
        totalCents: q.totalCents,
      });
      return savedOrder;
    });
  }

  private async nextSalesOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.salesOrderRepo.count({ where: { tenantId } });
    return `SO-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ─── DDT (S15.2) ──────────────────────────────────────────────

  async createDdt(tenantId: string, dto: CreateDdtDto): Promise<Ddt> {
    const ddtNumber = await this.nextDdtNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const ddt = manager.create(Ddt, {
        tenantId,
        ddtNumber,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId ?? null,
        issueDate: new Date(dto.issueDate),
        shippedAt: null,
        deliveredAt: null,
        status: 'draft' as DdtStatus,
        causaleTrasporto: (dto.causaleTrasporto ?? 'vendita') as DdtCausale,
        carrierId: dto.carrierId ?? null,
        trackingNumber: null,
        packageCount: dto.packageCount ?? 1,
        totalWeightKg: dto.totalWeightKg ?? null,
        shipFromAddress: dto.shipFromAddress ?? {},
        shipToAddress: dto.shipToAddress ?? {},
        invoiceId: null,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(ddt);
      const lineEntities = dto.lines.map((l) =>
        manager.create(DdtLine, {
          tenantId,
          ddtId: saved.id,
          productId: l.productId,
          salesOrderLineId: l.salesOrderLineId ?? null,
          description: l.description,
          quantity: l.quantity,
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          serialIds: l.serialIds ?? [],
          lotId: l.lotId ?? null,
        }),
      );
      await manager.save(lineEntities);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'sales.ddt_created',
        tenantId,
        ddtId: saved.id,
        customerId: dto.customerId,
        lineCount: lineEntities.length,
      });
      return saved;
    });
  }

  async getDdt(tenantId: string, id: string): Promise<Ddt> {
    const d = await this.ddtRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!d) throw new NotFoundException(`DDT ${id} not found`);
    return d;
  }

  async issueDdt(
    tenantId: string,
    id: string,
    dto: IssueDdtDto,
  ): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'issued', (d) => {
      d.trackingNumber = dto.trackingNumber ?? d.trackingNumber;
      d.carrierId = dto.carrierId ?? d.carrierId;
    });
  }

  async markDdtInTransit(
    tenantId: string,
    id: string,
    dto: MarkInTransitDdtDto,
  ): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'in_transit', (d) => {
      d.shippedAt = dto.shippedAt ? new Date(dto.shippedAt) : new Date();
      d.trackingNumber = dto.trackingNumber ?? d.trackingNumber;
    });
  }

  async markDdtDelivered(
    tenantId: string,
    id: string,
    dto: MarkDeliveredDdtDto,
  ): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'delivered', (d) => {
      d.deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : new Date();
    });
  }

  async cancelDdt(tenantId: string, id: string): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'cancelled');
  }

  async returnDdt(tenantId: string, id: string): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'returned');
  }

  async markDdtLost(tenantId: string, id: string): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'lost');
  }

  async disputeDdt(tenantId: string, id: string): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'disputed');
  }

  /**
   * Mark a delivered DDT as bundled into a fiscal invoice. Sets the
   * `invoiceId` link and transitions the DDT to `invoiced`. The actual
   * invoice creation is handled by AccountingService (out of scope this
   * sprint; see plan §31.1 Sprint 15 / S15.5).
   */
  async invoiceDdt(
    tenantId: string,
    id: string,
    invoiceId: string,
  ): Promise<Ddt> {
    return this.transitionDdt(tenantId, id, 'invoiced', (d) => {
      d.invoiceId = invoiceId;
    });
  }

  /**
   * Aggregate a set of DELIVERED DDTs (same customer) into the payload
   * that AccountingService will turn into a fattura differita per
   * DPR 633/1972 art. 21 (S15.5). Returns line items + DDT references
   * the invoice will quote in `<DatiDDT>`. Pure read-side; no
   * transition. The caller (AccountingService) creates the invoice and
   * subsequently calls `invoiceDdt(...)` for each DDT to flip status.
   *
   * Invariants:
   *   - All DDTs must belong to the tenant.
   *   - All DDTs must be the same customer.
   *   - All DDTs must be in status `delivered`.
   *   - Empty list throws BadRequestException.
   */
  async prepareInvoiceFromDdts(
    tenantId: string,
    ddtIds: string[],
  ): Promise<{
    customerId: string;
    ddts: Array<{ id: string; ddtNumber: string; issueDate: string }>;
    lines: Array<{
      productId: string;
      description: string;
      quantity: string;
      unitOfMeasure: string;
      ddtRef: string;
    }>;
  }> {
    if (!ddtIds || ddtIds.length === 0) {
      throw new BadRequestException('At least one DDT id is required');
    }
    const ddts = await this.ddtRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.lines', 'l')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.id IN (:...ids)', { ids: ddtIds })
      .getMany();
    if (ddts.length !== ddtIds.length) {
      throw new NotFoundException(
        `Found ${ddts.length} of ${ddtIds.length} DDT ids; some are missing or wrong tenant`,
      );
    }
    const customerIds = Array.from(new Set(ddts.map((d) => d.customerId)));
    if (customerIds.length > 1) {
      throw new BadRequestException(
        'All DDTs must belong to the same customer to bundle into a single invoice',
      );
    }
    for (const d of ddts) {
      if (d.status !== 'delivered') {
        throw new BadRequestException(
          `DDT ${d.id} is in status ${d.status}; must be 'delivered' to invoice`,
        );
      }
    }
    const lines: Array<{
      productId: string;
      description: string;
      quantity: string;
      unitOfMeasure: string;
      ddtRef: string;
    }> = [];
    for (const d of ddts) {
      for (const line of d.lines) {
        lines.push({
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          ddtRef: d.ddtNumber,
        });
      }
    }
    this.logger.log({
      event: 'sales.invoice_prepared_from_ddts',
      tenantId,
      customerId: customerIds[0],
      ddtCount: ddts.length,
      lineCount: lines.length,
    });
    return {
      customerId: customerIds[0],
      ddts: ddts.map((d) => ({
        id: d.id,
        ddtNumber: d.ddtNumber,
        issueDate:
          d.issueDate instanceof Date
            ? d.issueDate.toISOString().slice(0, 10)
            : String(d.issueDate),
      })),
      lines,
    };
  }

  // ─── ContactActivity (S15.3) ──────────────────────────────────

  async logActivity(
    tenantId: string,
    dto: CreateContactActivityDto,
  ): Promise<ContactActivity> {
    const a = this.activityRepo.create({
      tenantId,
      customerId: dto.customerId,
      contactPersonId: dto.contactPersonId ?? null,
      kind: dto.kind as ContactActivityKind,
      direction: (dto.direction ?? 'outbound') as ContactActivityDirection,
      occurredAt: new Date(dto.occurredAt),
      durationMinutes: dto.durationMinutes ?? null,
      subject: dto.subject,
      body: dto.body ?? null,
      linkedEntityType: (dto.linkedEntityType ?? 'customer') as ContactActivityLinkedEntityType,
      linkedEntityId: dto.linkedEntityId ?? null,
      recordedBy: dto.recordedBy,
      tags: dto.tags ?? [],
    });
    const saved = await this.activityRepo.save(a);
    this.logger.log({
      event: 'sales.activity_logged',
      tenantId,
      customerId: dto.customerId,
      kind: saved.kind,
      activityId: saved.id,
    });
    return saved;
  }

  async listActivities(
    tenantId: string,
    query: ListContactActivityQueryDto,
  ): Promise<ContactActivity[]> {
    const qb = this.activityRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .orderBy('a.occurredAt', 'DESC')
      .limit(query.limit ?? 50);
    if (query.customerId) {
      qb.andWhere('a.customerId = :customerId', { customerId: query.customerId });
    }
    if (query.kind) {
      qb.andWhere('a.kind = :kind', { kind: query.kind });
    }
    if (query.linkedEntityType && query.linkedEntityId) {
      qb.andWhere(
        'a.linkedEntityType = :let AND a.linkedEntityId = :lei',
        { let: query.linkedEntityType, lei: query.linkedEntityId },
      );
    }
    return qb.getMany();
  }

  // ─── private helpers ──────────────────────────────────────────

  private async nextQuotationNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.quotationRepo.count({ where: { tenantId } });
    return `QT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextDdtNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ddtRepo.count({ where: { tenantId } });
    return `DDT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async transitionQuotation(
    tenantId: string,
    id: string,
    next: QuotationStatus,
    mutator?: (q: Quotation) => void,
  ): Promise<Quotation> {
    const q = await this.getQuotation(tenantId, id);
    if (!canQuotationTransition(q.status, next)) {
      throw new BadRequestException(
        `Invalid Quotation transition: ${q.status} → ${next}`,
      );
    }
    if (next === 'converted' && !q.convertedToSalesOrderId) {
      throw new ConflictException(
        'Quotation can transition to converted only via convertToSalesOrder()',
      );
    }
    q.status = next;
    if (mutator) mutator(q);
    const saved = await this.quotationRepo.save(q);
    this.logger.log({
      event: 'sales.quotation_transitioned',
      tenantId,
      quotationId: id,
      to: next,
    });
    return saved;
  }

  private async transitionDdt(
    tenantId: string,
    id: string,
    next: DdtStatus,
    mutator?: (d: Ddt) => void,
  ): Promise<Ddt> {
    const d = await this.getDdt(tenantId, id);
    if (!canDdtTransition(d.status, next)) {
      throw new BadRequestException(
        `Invalid DDT transition: ${d.status} → ${next}`,
      );
    }
    d.status = next;
    if (mutator) mutator(d);
    const saved = await this.ddtRepo.save(d);
    this.logger.log({
      event: 'sales.ddt_transitioned',
      tenantId,
      ddtId: id,
      to: next,
    });
    return saved;
  }
}
