import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PurchaseRequisition,
  PurchaseRequisitionLine,
  type ApprovalStep,
  type PurchaseRequisitionStatus,
} from './entities/purchase-requisition.entity';
import {
  PurchaseOrder,
  PurchaseOrderLine,
  type PurchaseOrderStatus,
  type IncotermsCode,
} from './entities/purchase-order.entity';
import {
  RequestForQuote,
  RequestForQuoteLine,
  RequestForQuoteQuote,
  type RequestForQuoteStatus,
} from './entities/request-for-quote.entity';
import {
  GoodsReceipt,
  GoodsReceiptLine,
  type GoodsReceiptStatus,
} from './entities/goods-receipt.entity';
import {
  SupplierInvoice,
  SupplierInvoiceLine,
  type SupplierInvoiceStatus,
} from './entities/supplier-invoice.entity';
import {
  assertPurchaseRequisitionTransition,
  canPurchaseRequisitionTransition,
} from './state-machines/purchase-requisition.fsm';
import { canPurchaseOrderTransition } from './state-machines/purchase-order.fsm';
import { canRequestForQuoteTransition } from './state-machines/request-for-quote.fsm';
import {
  canGoodsReceiptTransition,
} from './state-machines/goods-receipt.fsm';
import {
  canSupplierInvoiceTransition,
} from './state-machines/supplier-invoice.fsm';
import {
  runThreeWayMatch,
  type PoLineSnapshot,
  type GrLineSnapshot,
  type SiLineSnapshot,
} from './three-way-match';
import {
  CreatePurchaseRequisitionDto,
  CreatePurchaseOrderDto,
  ApprovePurchaseRequisitionDto,
  RejectPurchaseRequisitionDto,
  ConvertPurchaseRequisitionDto,
  CancelPurchaseOrderDto,
  CreateRequestForQuoteDto,
  SendRequestForQuoteDto,
  RecordSupplierQuoteDto,
  AwardRfqDto,
  ConvertRfqToPoDto,
  CreateGoodsReceiptDto,
  InspectGoodsReceiptDto,
  CreateSupplierInvoiceDto,
  RunMatchDto,
  ApproveSupplierInvoiceDto,
  DisputeSupplierInvoiceDto,
} from './procurement.dto';

/**
 * Per-amount approval-chain rules (per plan §9.6.4 — to be made
 * tenant-configurable in Sprint 13.x; defaults shown here).
 *
 * A requisition's totalEstimateCents drives which roles are required to
 * approve. Manager covers up to €5,000; admin up to €25,000; founder
 * (admin + founder both required) above €25,000.
 */
const AUTO_APPROVE_THRESHOLD_CENTS = 50_000; // €500
const MANAGER_THRESHOLD_CENTS = 500_000; // €5,000
const ADMIN_THRESHOLD_CENTS = 2_500_000; // €25,000

function buildApprovalChain(totalEstimateCents: number): ApprovalStep[] {
  if (totalEstimateCents < AUTO_APPROVE_THRESHOLD_CENTS) {
    return [];
  }
  const steps: ApprovalStep[] = [];
  if (totalEstimateCents <= MANAGER_THRESHOLD_CENTS) {
    steps.push({ userId: '', role: 'manager', status: 'pending' });
  } else if (totalEstimateCents <= ADMIN_THRESHOLD_CENTS) {
    steps.push({ userId: '', role: 'admin', status: 'pending' });
  } else {
    steps.push({ userId: '', role: 'admin', status: 'pending' });
    steps.push({ userId: '', role: 'founder', status: 'pending' });
  }
  return steps;
}

function isApprovalChainComplete(chain: ApprovalStep[]): boolean {
  return chain.length > 0 && chain.every((s) => s.status === 'approved');
}

function nextPendingApprovalRole(chain: ApprovalStep[]): ApprovalStep | null {
  return chain.find((s) => s.status === 'pending') ?? null;
}

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    @InjectRepository(PurchaseRequisition)
    private readonly requisitionRepo: Repository<PurchaseRequisition>,
    @InjectRepository(PurchaseRequisitionLine)
    private readonly requisitionLineRepo: Repository<PurchaseRequisitionLine>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLine)
    private readonly poLineRepo: Repository<PurchaseOrderLine>,
    @InjectRepository(RequestForQuote)
    private readonly rfqRepo: Repository<RequestForQuote>,
    @InjectRepository(RequestForQuoteLine)
    private readonly rfqLineRepo: Repository<RequestForQuoteLine>,
    @InjectRepository(RequestForQuoteQuote)
    private readonly rfqQuoteRepo: Repository<RequestForQuoteQuote>,
    @InjectRepository(GoodsReceipt)
    private readonly grRepo: Repository<GoodsReceipt>,
    @InjectRepository(GoodsReceiptLine)
    private readonly grLineRepo: Repository<GoodsReceiptLine>,
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
    @InjectRepository(SupplierInvoiceLine)
    private readonly siLineRepo: Repository<SupplierInvoiceLine>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── PurchaseRequisition ──────────────────────────────────────

  async createRequisition(
    tenantId: string,
    dto: CreatePurchaseRequisitionDto,
  ): Promise<PurchaseRequisition> {
    const totalEstimateCents = dto.lines.reduce(
      (sum, l) =>
        sum + (l.estimatedUnitCostCents ?? 0) * Number(l.quantity ?? 0),
      0,
    );
    const requisitionNumber = await this.nextRequisitionNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const req = manager.create(PurchaseRequisition, {
        tenantId,
        requisitionNumber,
        requestedBy: dto.requestedBy,
        requestedDate: new Date(dto.requestedDate),
        needByDate: dto.needByDate ? new Date(dto.needByDate) : null,
        status: 'draft' as PurchaseRequisitionStatus,
        approverChain: buildApprovalChain(totalEstimateCents),
        totalEstimateCents,
        notes: dto.notes ?? null,
        convertedToPurchaseOrderId: null,
      });
      const saved = await manager.save(req);
      const lineEntities = dto.lines.map((l) =>
        manager.create(PurchaseRequisitionLine, {
          tenantId,
          requisitionId: saved.id,
          productId: l.productId,
          description: l.description,
          quantity: String(l.quantity),
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          estimatedUnitCostCents: l.estimatedUnitCostCents ?? 0,
          preferredSupplierId: l.preferredSupplierId ?? null,
          needByDate: l.needByDate ? new Date(l.needByDate) : null,
          notes: l.notes ?? null,
        }),
      );
      await manager.save(lineEntities);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'procurement.requisition_created',
        tenantId,
        requisitionId: saved.id,
        totalEstimateCents,
        approverChainLength: saved.approverChain.length,
      });
      return saved;
    });
  }

  async getRequisition(
    tenantId: string,
    id: string,
  ): Promise<PurchaseRequisition> {
    const req = await this.requisitionRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!req) throw new NotFoundException(`Requisition ${id} not found`);
    return req;
  }

  async submitRequisition(
    tenantId: string,
    id: string,
  ): Promise<PurchaseRequisition> {
    return this.transitionRequisition(tenantId, id, 'submitted', (req) => {
      // Auto-approve below threshold.
      if (req.approverChain.length === 0) {
        req.status = 'approved';
      }
    });
  }

  async approveRequisition(
    tenantId: string,
    id: string,
    dto: ApprovePurchaseRequisitionDto,
  ): Promise<PurchaseRequisition> {
    const req = await this.getRequisition(tenantId, id);
    if (req.status !== 'submitted' && req.status !== 'approved') {
      throw new BadRequestException(
        `Cannot approve a requisition in status ${req.status}`,
      );
    }
    const next = nextPendingApprovalRole(req.approverChain);
    if (!next) {
      throw new BadRequestException(
        'Approval chain is already complete; no pending approval expected',
      );
    }
    next.userId = dto.approverUserId;
    next.status = 'approved';
    next.approvedAt = new Date().toISOString();
    if (dto.comment) next.comment = dto.comment;
    if (isApprovalChainComplete(req.approverChain)) {
      assertPurchaseRequisitionTransition(req.status, 'approved');
      req.status = 'approved';
    }
    const saved = await this.requisitionRepo.save(req);
    this.logger.log({
      event: 'procurement.requisition_approved_step',
      tenantId,
      requisitionId: id,
      approverUserId: dto.approverUserId,
      complete: isApprovalChainComplete(saved.approverChain),
    });
    return saved;
  }

  async rejectRequisition(
    tenantId: string,
    id: string,
    dto: RejectPurchaseRequisitionDto,
  ): Promise<PurchaseRequisition> {
    return this.transitionRequisition(tenantId, id, 'rejected', (req) => {
      const next = nextPendingApprovalRole(req.approverChain);
      if (next) {
        next.userId = dto.approverUserId;
        next.status = 'rejected';
        next.rejectedAt = new Date().toISOString();
        next.comment = dto.comment;
      }
    });
  }

  async cancelRequisition(
    tenantId: string,
    id: string,
  ): Promise<PurchaseRequisition> {
    return this.transitionRequisition(tenantId, id, 'cancelled');
  }

  async convertRequisitionToPo(
    tenantId: string,
    id: string,
    dto: ConvertPurchaseRequisitionDto,
  ): Promise<PurchaseOrder> {
    const req = await this.getRequisition(tenantId, id);
    if (req.status !== 'approved') {
      throw new BadRequestException(
        `Cannot convert a requisition in status ${req.status}; must be 'approved'`,
      );
    }
    if (req.convertedToPurchaseOrderId) {
      throw new ConflictException(
        `Requisition already converted to PO ${req.convertedToPurchaseOrderId}`,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const poNumber = await this.nextPoNumber(tenantId);
      const po = manager.create(PurchaseOrder, {
        tenantId,
        poNumber,
        supplierId: dto.supplierId,
        requisitionId: req.id,
        orderDate: new Date(dto.orderDate),
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        shipToWarehouseId: dto.shipToWarehouseId ?? null,
        status: 'draft' as PurchaseOrderStatus,
        paymentTermsDays: dto.paymentTermsDays ?? 30,
        paymentMethod: 'sepa_bank_transfer',
        shippingTermsIncoterms:
          (dto.shippingTermsIncoterms as IncotermsCode | undefined) ?? null,
        currency: 'EUR',
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        notes: null,
      });
      const savedPo = await manager.save(po);
      const lineEntities = req.lines.map((rl) => {
        const qty = Number(rl.quantity);
        const lineTotalCents = rl.estimatedUnitCostCents * qty;
        return manager.create(PurchaseOrderLine, {
          tenantId,
          purchaseOrderId: savedPo.id,
          productId: rl.productId,
          description: rl.description,
          quantity: rl.quantity,
          unitOfMeasure: rl.unitOfMeasure,
          unitCostCents: rl.estimatedUnitCostCents,
          lineTotalCents,
          taxRate: 22,
          taxAmountCents: Math.round(lineTotalCents * 0.22),
          expectedDeliveryDate: rl.needByDate ?? null,
          receivedQuantity: '0',
          invoicedQuantity: '0',
          notes: rl.notes,
        });
      });
      await manager.save(lineEntities);
      const subtotalCents = lineEntities.reduce(
        (s, l) => s + l.lineTotalCents,
        0,
      );
      const taxCents = lineEntities.reduce((s, l) => s + l.taxAmountCents, 0);
      savedPo.subtotalCents = subtotalCents;
      savedPo.taxCents = taxCents;
      savedPo.totalCents = subtotalCents + taxCents;
      await manager.save(savedPo);
      assertPurchaseRequisitionTransition(req.status, 'converted');
      req.status = 'converted';
      req.convertedToPurchaseOrderId = savedPo.id;
      await manager.save(req);
      this.logger.log({
        event: 'procurement.requisition_converted',
        tenantId,
        requisitionId: req.id,
        purchaseOrderId: savedPo.id,
        totalCents: savedPo.totalCents,
      });
      return savedPo;
    });
  }

  // ─── PurchaseOrder ────────────────────────────────────────────

  async createPurchaseOrder(
    tenantId: string,
    dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const poNumber = await this.nextPoNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const po = manager.create(PurchaseOrder, {
        tenantId,
        poNumber,
        supplierId: dto.supplierId,
        requisitionId: dto.requisitionId ?? null,
        orderDate: new Date(dto.orderDate),
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        shipToWarehouseId: dto.shipToWarehouseId ?? null,
        status: 'draft' as PurchaseOrderStatus,
        paymentTermsDays: dto.paymentTermsDays ?? 30,
        paymentMethod: dto.paymentMethod ?? 'sepa_bank_transfer',
        shippingTermsIncoterms:
          (dto.shippingTermsIncoterms as IncotermsCode | undefined) ?? null,
        currency: dto.currency ?? 'EUR',
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(po);
      const lineEntities = dto.lines.map((l) => {
        const qty = Number(l.quantity);
        const lineTotalCents = l.unitCostCents * qty;
        const taxRate = l.taxRate ?? 22;
        return manager.create(PurchaseOrderLine, {
          tenantId,
          purchaseOrderId: saved.id,
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          unitCostCents: l.unitCostCents,
          lineTotalCents,
          taxRate,
          taxAmountCents: Math.round((lineTotalCents * taxRate) / 100),
          expectedDeliveryDate: l.expectedDeliveryDate
            ? new Date(l.expectedDeliveryDate)
            : null,
          receivedQuantity: '0',
          invoicedQuantity: '0',
          notes: l.notes ?? null,
        });
      });
      await manager.save(lineEntities);
      const subtotalCents = lineEntities.reduce(
        (s, l) => s + l.lineTotalCents,
        0,
      );
      const taxCents = lineEntities.reduce((s, l) => s + l.taxAmountCents, 0);
      saved.subtotalCents = subtotalCents;
      saved.taxCents = taxCents;
      saved.totalCents = subtotalCents + taxCents;
      await manager.save(saved);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'procurement.po_created',
        tenantId,
        purchaseOrderId: saved.id,
        totalCents: saved.totalCents,
      });
      return saved;
    });
  }

  async getPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  async sendPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrder> {
    return this.transitionPurchaseOrder(tenantId, id, 'sent', (po) => {
      po.sentAt = new Date();
    });
  }

  async acknowledgePurchaseOrder(
    tenantId: string,
    id: string,
  ): Promise<PurchaseOrder> {
    return this.transitionPurchaseOrder(tenantId, id, 'acknowledged', (po) => {
      po.acknowledgedAt = new Date();
    });
  }

  async cancelPurchaseOrder(
    tenantId: string,
    id: string,
    dto: CancelPurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    return this.transitionPurchaseOrder(tenantId, id, 'cancelled', (po) => {
      po.cancelledAt = new Date();
      po.cancellationReason = dto.reason;
    });
  }

  // ─── RequestForQuote ──────────────────────────────────────────

  async createRfq(
    tenantId: string,
    dto: CreateRequestForQuoteDto,
  ): Promise<RequestForQuote> {
    const rfqNumber = await this.nextRfqNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const rfq = manager.create(RequestForQuote, {
        tenantId,
        rfqNumber,
        requesterId: dto.requesterId,
        issueDate: new Date(dto.issueDate),
        validUntilDate: new Date(dto.validUntilDate),
        status: 'draft' as RequestForQuoteStatus,
        notes: dto.notes ?? null,
        awardedQuoteId: null,
        awardedAt: null,
        convertedToPurchaseOrderId: null,
      });
      const saved = await manager.save(rfq);
      const lineEntities = dto.lines.map((l) =>
        manager.create(RequestForQuoteLine, {
          tenantId,
          rfqId: saved.id,
          productId: l.productId,
          description: l.description,
          quantity: String(l.quantity),
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          needByDate: l.needByDate ? new Date(l.needByDate) : null,
        }),
      );
      await manager.save(lineEntities);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'procurement.rfq_created',
        tenantId,
        rfqId: saved.id,
        lineCount: lineEntities.length,
      });
      return saved;
    });
  }

  async getRfq(tenantId: string, id: string): Promise<RequestForQuote> {
    const rfq = await this.rfqRepo.findOne({
      where: { id, tenantId },
      relations: ['lines', 'quotes'],
    });
    if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);
    return rfq;
  }

  async sendRfq(
    tenantId: string,
    id: string,
    dto: SendRequestForQuoteDto,
  ): Promise<RequestForQuote> {
    const rfq = await this.getRfq(tenantId, id);
    if (!canRequestForQuoteTransition(rfq.status, 'sent')) {
      throw new BadRequestException(
        `Invalid transition: ${rfq.status} → sent`,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      rfq.status = 'sent';
      const saved = await manager.save(rfq);
      const quoteEntities = dto.supplierIds.map((supplierId) =>
        manager.create(RequestForQuoteQuote, {
          tenantId,
          rfqId: saved.id,
          supplierId,
          status: 'pending',
          totalCents: null,
          currency: 'EUR',
          validUntilDate: null,
          perLineCosts: [],
          receivedAt: null,
          notes: null,
        }),
      );
      await manager.save(quoteEntities);
      this.logger.log({
        event: 'procurement.rfq_sent',
        tenantId,
        rfqId: id,
        supplierCount: dto.supplierIds.length,
      });
      return saved;
    });
  }

  async recordSupplierQuote(
    tenantId: string,
    rfqId: string,
    dto: RecordSupplierQuoteDto,
  ): Promise<RequestForQuoteQuote> {
    const rfq = await this.getRfq(tenantId, rfqId);
    if (rfq.status !== 'sent' && rfq.status !== 'quotes_received') {
      throw new BadRequestException(
        `Cannot record a quote on RFQ in status ${rfq.status}`,
      );
    }
    const quote = await this.rfqQuoteRepo.findOne({
      where: { rfqId, supplierId: dto.supplierId, tenantId },
    });
    if (!quote) {
      throw new NotFoundException(
        `Supplier ${dto.supplierId} was not solicited for RFQ ${rfqId}`,
      );
    }
    quote.status = 'received';
    quote.totalCents = dto.totalCents;
    quote.currency = dto.currency ?? 'EUR';
    quote.validUntilDate = dto.validUntilDate ? new Date(dto.validUntilDate) : null;
    quote.perLineCosts = dto.perLineCosts;
    quote.receivedAt = new Date();
    quote.notes = dto.notes ?? null;
    const savedQuote = await this.rfqQuoteRepo.save(quote);

    // Promote RFQ to QUOTES_RECEIVED on first received quote.
    if (rfq.status === 'sent') {
      rfq.status = 'quotes_received';
      await this.rfqRepo.save(rfq);
    }
    this.logger.log({
      event: 'procurement.rfq_quote_received',
      tenantId,
      rfqId,
      supplierId: dto.supplierId,
      totalCents: dto.totalCents,
    });
    return savedQuote;
  }

  async awardRfq(
    tenantId: string,
    rfqId: string,
    dto: AwardRfqDto,
  ): Promise<RequestForQuote> {
    const rfq = await this.getRfq(tenantId, rfqId);
    if (!canRequestForQuoteTransition(rfq.status, 'awarded')) {
      throw new BadRequestException(
        `Invalid transition: ${rfq.status} → awarded`,
      );
    }
    const quote = await this.rfqQuoteRepo.findOne({
      where: { id: dto.quoteId, rfqId, tenantId },
    });
    if (!quote) {
      throw new NotFoundException(
        `Quote ${dto.quoteId} not found on RFQ ${rfqId}`,
      );
    }
    if (quote.status !== 'received') {
      throw new BadRequestException(
        `Cannot award a quote in status ${quote.status}; must be 'received'`,
      );
    }
    rfq.status = 'awarded';
    rfq.awardedQuoteId = quote.id;
    rfq.awardedAt = new Date();
    const saved = await this.rfqRepo.save(rfq);
    this.logger.log({
      event: 'procurement.rfq_awarded',
      tenantId,
      rfqId,
      quoteId: quote.id,
      supplierId: quote.supplierId,
      totalCents: quote.totalCents,
    });
    return saved;
  }

  async cancelRfq(tenantId: string, id: string): Promise<RequestForQuote> {
    const rfq = await this.getRfq(tenantId, id);
    if (!canRequestForQuoteTransition(rfq.status, 'cancelled')) {
      throw new BadRequestException(
        `Invalid transition: ${rfq.status} → cancelled`,
      );
    }
    rfq.status = 'cancelled';
    return this.rfqRepo.save(rfq);
  }

  async convertRfqToPo(
    tenantId: string,
    rfqId: string,
    dto: ConvertRfqToPoDto,
  ): Promise<PurchaseOrder> {
    const rfq = await this.getRfq(tenantId, rfqId);
    if (rfq.status !== 'awarded') {
      throw new BadRequestException(
        `Cannot convert RFQ in status ${rfq.status}; must be 'awarded'`,
      );
    }
    if (!rfq.awardedQuoteId) {
      throw new BadRequestException('RFQ has no awardedQuoteId');
    }
    if (rfq.convertedToPurchaseOrderId) {
      throw new ConflictException(
        `RFQ already converted to PO ${rfq.convertedToPurchaseOrderId}`,
      );
    }
    const quote = await this.rfqQuoteRepo.findOne({
      where: { id: rfq.awardedQuoteId, tenantId },
    });
    if (!quote) {
      throw new NotFoundException('Awarded quote no longer exists');
    }
    return this.dataSource.transaction(async (manager) => {
      const poNumber = await this.nextPoNumber(tenantId);
      const po = manager.create(PurchaseOrder, {
        tenantId,
        poNumber,
        supplierId: quote.supplierId,
        requisitionId: null,
        orderDate: new Date(dto.orderDate),
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        shipToWarehouseId: dto.shipToWarehouseId ?? null,
        status: 'draft' as PurchaseOrderStatus,
        paymentTermsDays: dto.paymentTermsDays ?? 30,
        paymentMethod: 'sepa_bank_transfer',
        shippingTermsIncoterms:
          (dto.shippingTermsIncoterms as IncotermsCode | undefined) ?? null,
        currency: quote.currency,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        notes: null,
      });
      const savedPo = await manager.save(po);
      const lineEntities = rfq.lines.map((rl) => {
        const cost = quote.perLineCosts.find((c) => c.rfqLineId === rl.id);
        const unitCostCents = cost?.unitCostCents ?? 0;
        const qty = Number(rl.quantity);
        const lineTotalCents = unitCostCents * qty;
        return manager.create(PurchaseOrderLine, {
          tenantId,
          purchaseOrderId: savedPo.id,
          productId: rl.productId,
          description: rl.description,
          quantity: rl.quantity,
          unitOfMeasure: rl.unitOfMeasure,
          unitCostCents,
          lineTotalCents,
          taxRate: 22,
          taxAmountCents: Math.round(lineTotalCents * 0.22),
          expectedDeliveryDate: rl.needByDate ?? null,
          receivedQuantity: '0',
          invoicedQuantity: '0',
          notes: null,
        });
      });
      await manager.save(lineEntities);
      const subtotalCents = lineEntities.reduce(
        (s, l) => s + l.lineTotalCents,
        0,
      );
      const taxCents = lineEntities.reduce((s, l) => s + l.taxAmountCents, 0);
      savedPo.subtotalCents = subtotalCents;
      savedPo.taxCents = taxCents;
      savedPo.totalCents = subtotalCents + taxCents;
      await manager.save(savedPo);
      rfq.status = 'converted';
      rfq.convertedToPurchaseOrderId = savedPo.id;
      await manager.save(rfq);
      this.logger.log({
        event: 'procurement.rfq_converted',
        tenantId,
        rfqId,
        purchaseOrderId: savedPo.id,
        totalCents: savedPo.totalCents,
      });
      return savedPo;
    });
  }

  private async nextRfqNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.rfqRepo.count({ where: { tenantId } });
    return `RFQ-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ─── GoodsReceipt (S14.1) ─────────────────────────────────────

  async createGoodsReceipt(
    tenantId: string,
    dto: CreateGoodsReceiptDto,
  ): Promise<GoodsReceipt> {
    // Verify the PO exists and belongs to tenant.
    const po = await this.poRepo.findOne({
      where: { id: dto.poId, tenantId },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order ${dto.poId} not found`);
    }
    if (po.status === 'cancelled' || po.status === 'closed') {
      throw new BadRequestException(
        `Cannot receive against PO in status ${po.status}`,
      );
    }
    const grNumber = await this.nextGrNumber(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const gr = manager.create(GoodsReceipt, {
        tenantId,
        grNumber,
        poId: dto.poId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        receiptDate: new Date(dto.receiptDate),
        receivedBy: dto.receivedBy,
        carrierTrackingNumber: dto.carrierTrackingNumber ?? null,
        supplierDdtNumber: dto.supplierDdtNumber ?? null,
        supplierDdtDate: dto.supplierDdtDate
          ? new Date(dto.supplierDdtDate)
          : null,
        status: 'draft' as GoodsReceiptStatus,
        notes: dto.notes ?? null,
        confirmedAt: null,
        inspectedAt: null,
      });
      const saved = await manager.save(gr);
      const lineEntities = dto.lines.map((l) =>
        manager.create(GoodsReceiptLine, {
          tenantId,
          goodsReceiptId: saved.id,
          poLineId: l.poLineId,
          productId: l.productId,
          receivedQuantity: l.receivedQuantity,
          // On creation, default accepted = received (full accept). Inspection
          // may later split into accepted/rejected via inspectGoodsReceipt().
          acceptedQuantity: l.acceptedQuantity ?? l.receivedQuantity,
          rejectedQuantity: l.rejectedQuantity ?? '0',
          rejectReason: l.rejectReason ?? null,
          lotId: l.lotId ?? null,
          serialIds: l.serialIds ?? [],
          inspectionId: null,
          warehouseLocation: l.warehouseLocation ?? null,
        }),
      );
      await manager.save(lineEntities);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'procurement.gr_created',
        tenantId,
        goodsReceiptId: saved.id,
        poId: dto.poId,
        lineCount: lineEntities.length,
      });
      return saved;
    });
  }

  async getGoodsReceipt(tenantId: string, id: string): Promise<GoodsReceipt> {
    const gr = await this.grRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!gr) throw new NotFoundException(`Goods receipt ${id} not found`);
    return gr;
  }

  async confirmGoodsReceipt(
    tenantId: string,
    id: string,
  ): Promise<GoodsReceipt> {
    return this.transitionGoodsReceipt(tenantId, id, 'confirmed', (gr) => {
      gr.confirmedAt = new Date();
    });
  }

  async inspectGoodsReceipt(
    tenantId: string,
    id: string,
    dto: InspectGoodsReceiptDto,
  ): Promise<GoodsReceipt> {
    const gr = await this.getGoodsReceipt(tenantId, id);
    if (gr.status !== 'confirmed' && gr.status !== 'partially_inspected') {
      throw new BadRequestException(
        `Cannot inspect a GR in status ${gr.status}; must be confirmed or partially_inspected`,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      for (const li of dto.lines) {
        const grl = gr.lines.find((g) => g.id === li.goodsReceiptLineId);
        if (!grl) {
          throw new NotFoundException(
            `GR line ${li.goodsReceiptLineId} not found on GR ${id}`,
          );
        }
        const acc = Number(li.acceptedQuantity);
        const rej = Number(li.rejectedQuantity);
        const recv = Number(grl.receivedQuantity);
        if (acc + rej > recv + 0.0001) {
          throw new BadRequestException(
            `Line ${grl.id}: accepted+rejected (${acc + rej}) > received (${recv})`,
          );
        }
        grl.acceptedQuantity = li.acceptedQuantity;
        grl.rejectedQuantity = li.rejectedQuantity;
        grl.rejectReason = li.rejectReason ?? grl.rejectReason;
        grl.inspectionId = li.inspectionId ?? grl.inspectionId;
        await manager.save(grl);
      }
      // Decide GR-level transition: fully inspected if every line settled.
      const allSettled = gr.lines.every((g) => {
        const a = Number(g.acceptedQuantity);
        const r = Number(g.rejectedQuantity);
        const v = Number(g.receivedQuantity);
        return Math.abs(a + r - v) < 0.0001;
      });
      const next: GoodsReceiptStatus = allSettled
        ? 'inspected'
        : 'partially_inspected';
      gr.status = next;
      if (next === 'inspected') gr.inspectedAt = new Date();
      const saved = await manager.save(gr);
      this.logger.log({
        event: 'procurement.gr_inspected',
        tenantId,
        goodsReceiptId: id,
        next,
      });
      return saved;
    });
  }

  async rejectGoodsReceipt(
    tenantId: string,
    id: string,
  ): Promise<GoodsReceipt> {
    return this.transitionGoodsReceipt(tenantId, id, 'rejected');
  }

  // ─── SupplierInvoice (S14.2) ──────────────────────────────────

  async createSupplierInvoice(
    tenantId: string,
    dto: CreateSupplierInvoiceDto,
  ): Promise<SupplierInvoice> {
    // Header-level integrity: subtotal + tax = total (exact integer arithmetic).
    if (dto.subtotalCents + dto.taxCents !== dto.totalCents) {
      throw new BadRequestException(
        `subtotal+tax (${dto.subtotalCents + dto.taxCents}) != total (${dto.totalCents})`,
      );
    }
    // Reject duplicates explicitly (the unique index also guards in DB).
    const dup = await this.siRepo.findOne({
      where: {
        tenantId,
        supplierId: dto.supplierId,
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
      },
    });
    if (dup) {
      throw new ConflictException(
        `Supplier invoice ${dto.supplierInvoiceNumber} from supplier ${dto.supplierId} already exists`,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const si = manager.create(SupplierInvoice, {
        tenantId,
        supplierId: dto.supplierId,
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
        supplierInvoiceDate: new Date(dto.supplierInvoiceDate),
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
        receivedVia: dto.receivedVia ?? 'manual',
        externalMessageId: dto.externalMessageId ?? null,
        fatturaPaXmlPath: dto.fatturaPaXmlPath ?? null,
        subtotalCents: dto.subtotalCents,
        taxCents: dto.taxCents,
        totalCents: dto.totalCents,
        ivaBreakdown: dto.ivaBreakdown ?? [],
        paymentDueDate: new Date(dto.paymentDueDate),
        paymentTermsDays: dto.paymentTermsDays ?? 30,
        status: 'received' as SupplierInvoiceStatus,
        poIds: dto.poIds ?? [],
        discrepancies: null,
        matchedAt: null,
        matchedBy: null,
        approvedAt: null,
        approvedBy: null,
        paidAt: null,
        paymentBatchId: null,
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(si);
      const lineEntities = dto.lines.map((l) =>
        manager.create(SupplierInvoiceLine, {
          tenantId,
          supplierInvoiceId: saved.id,
          description: l.description,
          quantity: l.quantity,
          unitOfMeasure: l.unitOfMeasure ?? 'pz',
          unitCostCents: l.unitCostCents,
          lineTotalCents: l.lineTotalCents,
          taxRate: l.taxRate ?? 22,
          taxAmountCents:
            l.taxAmountCents ??
            Math.round((l.lineTotalCents * (l.taxRate ?? 22)) / 100),
          naturaCode: l.naturaCode ?? null,
          poLineId: l.poLineId ?? null,
          notes: l.notes ?? null,
        }),
      );
      await manager.save(lineEntities);
      saved.lines = lineEntities;
      this.logger.log({
        event: 'procurement.si_created',
        tenantId,
        supplierInvoiceId: saved.id,
        supplierId: dto.supplierId,
        totalCents: dto.totalCents,
        receivedVia: saved.receivedVia,
      });
      return saved;
    });
  }

  async getSupplierInvoice(
    tenantId: string,
    id: string,
  ): Promise<SupplierInvoice> {
    const si = await this.siRepo.findOne({
      where: { id, tenantId },
      relations: ['lines'],
    });
    if (!si) throw new NotFoundException(`Supplier invoice ${id} not found`);
    return si;
  }

  /**
   * Run the 3-way match (PO ↔ GR ↔ SI). Loads all PO lines + accepted GR
   * lines for every PO referenced by the SI lines, evaluates per
   * `runThreeWayMatch`, persists discrepancies, and transitions the SI to
   * `matched` (clean) or `disputed` (any discrepancy).
   */
  async runMatch(
    tenantId: string,
    siId: string,
    dto: RunMatchDto = {},
  ): Promise<SupplierInvoice> {
    const si = await this.getSupplierInvoice(tenantId, siId);
    if (si.status !== 'received') {
      throw new BadRequestException(
        `Cannot run match on SI in status ${si.status}; must be 'received'`,
      );
    }
    // Collect distinct PO line ids referenced by the SI.
    const poLineIds = Array.from(
      new Set(si.lines.map((l) => l.poLineId).filter((x): x is string => !!x)),
    );
    const poLines = poLineIds.length
      ? await this.poLineRepo
          .createQueryBuilder('pol')
          .where('pol.tenantId = :tenantId', { tenantId })
          .andWhere('pol.id IN (:...ids)', { ids: poLineIds })
          .getMany()
      : [];
    const poLineSnaps: PoLineSnapshot[] = poLines.map((pol) => ({
      poLineId: pol.id,
      productId: pol.productId,
      quantity: pol.quantity,
      unitCostCents: pol.unitCostCents,
      taxRate: pol.taxRate,
    }));
    // Load all GR lines for the same PO line ids.
    const grLines = poLineIds.length
      ? await this.grLineRepo
          .createQueryBuilder('grl')
          .where('grl.tenantId = :tenantId', { tenantId })
          .andWhere('grl.poLineId IN (:...ids)', { ids: poLineIds })
          .getMany()
      : [];
    const grLineSnaps: GrLineSnapshot[] = grLines.map((g) => ({
      poLineId: g.poLineId,
      acceptedQuantity: g.acceptedQuantity,
    }));
    const siLineSnaps: SiLineSnapshot[] = si.lines.map((l) => ({
      invoiceLineId: l.id,
      poLineId: l.poLineId,
      quantity: l.quantity,
      unitCostCents: l.unitCostCents,
      taxRate: l.taxRate,
      lineTotalCents: l.lineTotalCents,
    }));
    const result = runThreeWayMatch({
      poLines: poLineSnaps,
      grLines: grLineSnaps,
      siLines: siLineSnaps,
      siTotalCents: si.totalCents,
      tolerances: {
        quantityPct: dto.quantityPct,
        pricePct: dto.pricePct,
        totalPct: dto.totalPct,
      },
    });
    const next: SupplierInvoiceStatus = result.matched ? 'matched' : 'disputed';
    si.discrepancies = result.discrepancies.length ? result.discrepancies : null;
    si.status = next;
    if (next === 'matched') {
      si.matchedAt = new Date();
    }
    // Refresh poIds: the set of PO ids the SI now touches (derived from PO lines).
    if (poLines.length) {
      const poIds = Array.from(new Set(poLines.map((p) => p.purchaseOrderId)));
      si.poIds = poIds;
    }
    const saved = await this.siRepo.save(si);
    this.logger.log({
      event: 'procurement.si_matched',
      tenantId,
      supplierInvoiceId: siId,
      matched: result.matched,
      discrepancyCount: result.discrepancies.length,
      next,
    });
    return saved;
  }

  async approveSupplierInvoice(
    tenantId: string,
    id: string,
    dto: ApproveSupplierInvoiceDto,
  ): Promise<SupplierInvoice> {
    return this.transitionSupplierInvoice(tenantId, id, 'approved', (si) => {
      si.approvedAt = new Date();
      si.approvedBy = dto.approverUserId;
    });
  }

  async disputeSupplierInvoice(
    tenantId: string,
    id: string,
    dto: DisputeSupplierInvoiceDto,
  ): Promise<SupplierInvoice> {
    return this.transitionSupplierInvoice(tenantId, id, 'disputed', (si) => {
      si.notes = si.notes ? `${si.notes}\n[DISPUTE] ${dto.reason}` : `[DISPUTE] ${dto.reason}`;
    });
  }

  async rejectSupplierInvoice(
    tenantId: string,
    id: string,
  ): Promise<SupplierInvoice> {
    return this.transitionSupplierInvoice(tenantId, id, 'rejected');
  }

  async cancelSupplierInvoice(
    tenantId: string,
    id: string,
  ): Promise<SupplierInvoice> {
    return this.transitionSupplierInvoice(tenantId, id, 'cancelled');
  }

  private async nextGrNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.grRepo.count({ where: { tenantId } });
    return `GR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async transitionGoodsReceipt(
    tenantId: string,
    id: string,
    next: GoodsReceiptStatus,
    mutator?: (gr: GoodsReceipt) => void,
  ): Promise<GoodsReceipt> {
    const gr = await this.getGoodsReceipt(tenantId, id);
    if (!canGoodsReceiptTransition(gr.status, next)) {
      throw new BadRequestException(
        `Invalid transition: ${gr.status} → ${next}`,
      );
    }
    gr.status = next;
    if (mutator) mutator(gr);
    const saved = await this.grRepo.save(gr);
    this.logger.log({
      event: 'procurement.gr_transitioned',
      tenantId,
      goodsReceiptId: id,
      to: next,
    });
    return saved;
  }

  private async transitionSupplierInvoice(
    tenantId: string,
    id: string,
    next: SupplierInvoiceStatus,
    mutator?: (si: SupplierInvoice) => void,
  ): Promise<SupplierInvoice> {
    const si = await this.getSupplierInvoice(tenantId, id);
    if (!canSupplierInvoiceTransition(si.status, next)) {
      throw new BadRequestException(
        `Invalid transition: ${si.status} → ${next}`,
      );
    }
    si.status = next;
    if (mutator) mutator(si);
    const saved = await this.siRepo.save(si);
    this.logger.log({
      event: 'procurement.si_transitioned',
      tenantId,
      supplierInvoiceId: id,
      to: next,
    });
    return saved;
  }

  // ─── private helpers ──────────────────────────────────────────

  private async transitionRequisition(
    tenantId: string,
    id: string,
    next: PurchaseRequisitionStatus,
    mutator?: (req: PurchaseRequisition) => void,
  ): Promise<PurchaseRequisition> {
    const req = await this.getRequisition(tenantId, id);
    if (!canPurchaseRequisitionTransition(req.status, next)) {
      throw new BadRequestException(
        `Invalid transition: ${req.status} → ${next}`,
      );
    }
    req.status = next;
    if (mutator) mutator(req);
    const saved = await this.requisitionRepo.save(req);
    this.logger.log({
      event: 'procurement.requisition_transitioned',
      tenantId,
      requisitionId: id,
      to: next,
    });
    return saved;
  }

  private async transitionPurchaseOrder(
    tenantId: string,
    id: string,
    next: PurchaseOrderStatus,
    mutator?: (po: PurchaseOrder) => void,
  ): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(tenantId, id);
    if (!canPurchaseOrderTransition(po.status, next)) {
      throw new BadRequestException(`Invalid transition: ${po.status} → ${next}`);
    }
    po.status = next;
    if (mutator) mutator(po);
    const saved = await this.poRepo.save(po);
    this.logger.log({
      event: 'procurement.po_transitioned',
      tenantId,
      purchaseOrderId: id,
      to: next,
    });
    return saved;
  }

  private async nextRequisitionNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.requisitionRepo.count({
      where: { tenantId },
    });
    return `PR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextPoNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.poRepo.count({ where: { tenantId } });
    return `PO-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // Tenant-isolation belt-and-braces (R-D02): callers must pass tenantId;
  // these helpers throw if the loaded entity does not match the caller's
  // tenant. Used by future cross-aggregate operations (e.g., approval
  // notifications) to add an explicit check beyond the WHERE clause.
  assertTenantOwnership(req: PurchaseRequisition | null, tenantId: string): void {
    if (req && req.tenantId !== tenantId) {
      throw new ForbiddenException('cross-tenant access');
    }
  }
}
