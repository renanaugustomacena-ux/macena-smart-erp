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
  CancelPurchaseOrderDto,
  ConvertPurchaseRequisitionDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequisitionDto,
  RejectPurchaseRequisitionDto,
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
}
