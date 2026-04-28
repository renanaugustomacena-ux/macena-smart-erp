import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ProcurementService } from './procurement.service';
import {
  ApprovePurchaseRequisitionDto,
  ApproveSupplierInvoiceDto,
  AwardRfqDto,
  CancelPurchaseOrderDto,
  ConvertPurchaseRequisitionDto,
  ConvertRfqToPoDto,
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequisitionDto,
  CreateRequestForQuoteDto,
  CreateSupplierInvoiceDto,
  DisputeSupplierInvoiceDto,
  InspectGoodsReceiptDto,
  RecordSupplierQuoteDto,
  RejectPurchaseRequisitionDto,
  RunMatchDto,
  SendRequestForQuoteDto,
} from './procurement.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Procurement')
@ApiBearerAuth('JWT-auth')
@Controller('procurement')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  // ─── PurchaseRequisition ──────────────────────────────────────

  @Post('requisitions')
  @ApiOperation({ summary: 'Create a Purchase Requisition (DRAFT)' })
  @ApiResponse({ status: 201, description: 'Requisition created' })
  async createRequisition(
    @Req() req: RequestWithUser,
    @Body() dto: CreatePurchaseRequisitionDto,
  ) {
    return this.svc.createRequisition(req.user.tenantId, dto);
  }

  @Get('requisitions/:id')
  @ApiOperation({ summary: 'Get a Purchase Requisition by id' })
  async getRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getRequisition(req.user.tenantId, id);
  }

  @Post('requisitions/:id/submit')
  @ApiOperation({ summary: 'Submit a Purchase Requisition for approval' })
  async submitRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.submitRequisition(req.user.tenantId, id);
  }

  @Post('requisitions/:id/approve')
  @ApiOperation({ summary: 'Record one approval step on a Purchase Requisition' })
  async approveRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovePurchaseRequisitionDto,
  ) {
    return this.svc.approveRequisition(req.user.tenantId, id, dto);
  }

  @Post('requisitions/:id/reject')
  @ApiOperation({ summary: 'Reject a Purchase Requisition' })
  async rejectRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPurchaseRequisitionDto,
  ) {
    return this.svc.rejectRequisition(req.user.tenantId, id, dto);
  }

  @Post('requisitions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a Purchase Requisition' })
  async cancelRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelRequisition(req.user.tenantId, id);
  }

  @Post('requisitions/:id/convert')
  @ApiOperation({ summary: 'Convert an APPROVED Requisition to a Purchase Order' })
  async convertRequisition(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertPurchaseRequisitionDto,
  ) {
    return this.svc.convertRequisitionToPo(req.user.tenantId, id, dto);
  }

  // ─── PurchaseOrder ────────────────────────────────────────────

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create a Purchase Order (DRAFT)' })
  async createPurchaseOrder(
    @Req() req: RequestWithUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.svc.createPurchaseOrder(req.user.tenantId, dto);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get a Purchase Order by id' })
  async getPurchaseOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getPurchaseOrder(req.user.tenantId, id);
  }

  @Post('purchase-orders/:id/send')
  @ApiOperation({ summary: 'Send the Purchase Order to the supplier' })
  async sendPurchaseOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.sendPurchaseOrder(req.user.tenantId, id);
  }

  @Post('purchase-orders/:id/acknowledge')
  @ApiOperation({ summary: 'Mark the Purchase Order acknowledged by the supplier' })
  async acknowledgePurchaseOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.acknowledgePurchaseOrder(req.user.tenantId, id);
  }

  @Post('purchase-orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel a Purchase Order' })
  async cancelPurchaseOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPurchaseOrderDto,
  ) {
    return this.svc.cancelPurchaseOrder(req.user.tenantId, id, dto);
  }

  // ─── RequestForQuote ──────────────────────────────────────────

  @Post('rfqs')
  @ApiOperation({ summary: 'Create an RFQ (DRAFT)' })
  async createRfq(
    @Req() req: RequestWithUser,
    @Body() dto: CreateRequestForQuoteDto,
  ) {
    return this.svc.createRfq(req.user.tenantId, dto);
  }

  @Get('rfqs/:id')
  @ApiOperation({ summary: 'Get an RFQ by id' })
  async getRfq(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getRfq(req.user.tenantId, id);
  }

  @Post('rfqs/:id/send')
  @ApiOperation({ summary: 'Send an RFQ to a list of suppliers' })
  async sendRfq(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendRequestForQuoteDto,
  ) {
    return this.svc.sendRfq(req.user.tenantId, id, dto);
  }

  @Post('rfqs/:id/quotes')
  @ApiOperation({ summary: 'Record a supplier quote on an RFQ' })
  async recordSupplierQuote(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordSupplierQuoteDto,
  ) {
    return this.svc.recordSupplierQuote(req.user.tenantId, id, dto);
  }

  @Post('rfqs/:id/award')
  @ApiOperation({ summary: 'Award the RFQ to a winning quote' })
  async awardRfq(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AwardRfqDto,
  ) {
    return this.svc.awardRfq(req.user.tenantId, id, dto);
  }

  @Post('rfqs/:id/cancel')
  @ApiOperation({ summary: 'Cancel an RFQ' })
  async cancelRfq(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelRfq(req.user.tenantId, id);
  }

  @Post('rfqs/:id/convert')
  @ApiOperation({ summary: 'Convert an awarded RFQ to a Purchase Order' })
  async convertRfqToPo(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertRfqToPoDto,
  ) {
    return this.svc.convertRfqToPo(req.user.tenantId, id, dto);
  }

  // ─── GoodsReceipt (S14.1) ─────────────────────────────────────

  @Post('goods-receipts')
  @ApiOperation({ summary: 'Create a Goods Receipt against a PO (DRAFT)' })
  async createGoodsReceipt(
    @Req() req: RequestWithUser,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.svc.createGoodsReceipt(req.user.tenantId, dto);
  }

  @Get('goods-receipts/:id')
  @ApiOperation({ summary: 'Get a Goods Receipt by id' })
  async getGoodsReceipt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getGoodsReceipt(req.user.tenantId, id);
  }

  @Post('goods-receipts/:id/confirm')
  @ApiOperation({
    summary:
      'Confirm a Goods Receipt (triggers downstream stock movements in S15.x)',
  })
  async confirmGoodsReceipt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.confirmGoodsReceipt(req.user.tenantId, id);
  }

  @Post('goods-receipts/:id/inspect')
  @ApiOperation({
    summary: 'Record QC inspection results (per-line accept/reject quantities)',
  })
  async inspectGoodsReceipt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InspectGoodsReceiptDto,
  ) {
    return this.svc.inspectGoodsReceipt(req.user.tenantId, id, dto);
  }

  @Post('goods-receipts/:id/reject')
  @ApiOperation({ summary: 'Reject a Goods Receipt entirely' })
  async rejectGoodsReceipt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.rejectGoodsReceipt(req.user.tenantId, id);
  }

  // ─── SupplierInvoice (S14.2 + S14.3) ──────────────────────────

  @Post('supplier-invoices')
  @ApiOperation({ summary: 'Create a Supplier Invoice (RECEIVED)' })
  async createSupplierInvoice(
    @Req() req: RequestWithUser,
    @Body() dto: CreateSupplierInvoiceDto,
  ) {
    return this.svc.createSupplierInvoice(req.user.tenantId, dto);
  }

  @Get('supplier-invoices/:id')
  @ApiOperation({ summary: 'Get a Supplier Invoice by id' })
  async getSupplierInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getSupplierInvoice(req.user.tenantId, id);
  }

  @Post('supplier-invoices/:id/match')
  @ApiOperation({
    summary:
      'Run the 3-way match (PO ↔ GR ↔ SI). Sets status to MATCHED or DISPUTED.',
  })
  async runMatch(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunMatchDto,
  ) {
    return this.svc.runMatch(req.user.tenantId, id, dto);
  }

  @Post('supplier-invoices/:id/approve')
  @ApiOperation({ summary: 'Approve a matched Supplier Invoice for payment' })
  async approveSupplierInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveSupplierInvoiceDto,
  ) {
    return this.svc.approveSupplierInvoice(req.user.tenantId, id, dto);
  }

  @Post('supplier-invoices/:id/dispute')
  @ApiOperation({ summary: 'Mark a Supplier Invoice as disputed' })
  async disputeSupplierInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeSupplierInvoiceDto,
  ) {
    return this.svc.disputeSupplierInvoice(req.user.tenantId, id, dto);
  }

  @Post('supplier-invoices/:id/reject')
  @ApiOperation({ summary: 'Reject a Supplier Invoice (terminal)' })
  async rejectSupplierInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.rejectSupplierInvoice(req.user.tenantId, id);
  }

  @Post('supplier-invoices/:id/cancel')
  @ApiOperation({ summary: 'Cancel a Supplier Invoice (terminal)' })
  async cancelSupplierInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelSupplierInvoice(req.user.tenantId, id);
  }
}
