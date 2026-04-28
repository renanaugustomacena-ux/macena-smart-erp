import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { SalesDepthService } from './sales-depth.service';
import {
  AcceptQuotationDto,
  CreateContactActivityDto,
  CreateDdtDto,
  CreateQuotationDto,
  IssueDdtDto,
  ListContactActivityQueryDto,
  MarkDeliveredDdtDto,
  MarkInTransitDdtDto,
  RejectQuotationDto,
  ReviseQuotationDto,
} from './sales-depth.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Sales (depth)')
@ApiBearerAuth('JWT-auth')
@Controller('sales')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class SalesDepthController {
  constructor(private readonly svc: SalesDepthService) {}

  // ─── Quotation (S15.1) ────────────────────────────────────────

  @Post('quotations')
  @ApiOperation({ summary: 'Create a Quotation (DRAFT)' })
  async createQuotation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.svc.createQuotation(req.user.tenantId, dto);
  }

  @Get('quotations/:id')
  @ApiOperation({ summary: 'Get a Quotation by id' })
  async getQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getQuotation(req.user.tenantId, id);
  }

  @Post('quotations/:id/send')
  @ApiOperation({ summary: 'Send Quotation to customer' })
  async sendQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.sendQuotation(req.user.tenantId, id);
  }

  @Post('quotations/:id/revise')
  @ApiOperation({ summary: 'Mark Quotation as REVISED (renegotiation in flight)' })
  async reviseQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviseQuotationDto,
  ) {
    return this.svc.reviseQuotation(req.user.tenantId, id, dto);
  }

  @Post('quotations/:id/accept')
  @ApiOperation({ summary: 'Customer accepts Quotation' })
  async acceptQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptQuotationDto,
  ) {
    return this.svc.acceptQuotation(req.user.tenantId, id, dto);
  }

  @Post('quotations/:id/reject')
  @ApiOperation({ summary: 'Customer rejects Quotation' })
  async rejectQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuotationDto,
  ) {
    return this.svc.rejectQuotation(req.user.tenantId, id, dto);
  }

  @Post('quotations/:id/expire')
  @ApiOperation({ summary: 'Mark Quotation as expired' })
  async expireQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.expireQuotation(req.user.tenantId, id);
  }

  @Post('quotations/:id/convert')
  @ApiOperation({ summary: 'Convert an ACCEPTED Quotation into a SalesOrder (S15.4)' })
  async convertQuotation(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { orderDate?: string },
  ) {
    return this.svc.convertQuotationToSalesOrder(req.user.tenantId, id, body ?? {});
  }

  // ─── DDT (S15.2) ──────────────────────────────────────────────

  @Post('ddts')
  @ApiOperation({ summary: 'Create a DDT (DRAFT)' })
  async createDdt(@Req() req: RequestWithUser, @Body() dto: CreateDdtDto) {
    return this.svc.createDdt(req.user.tenantId, dto);
  }

  @Get('ddts/:id')
  @ApiOperation({ summary: 'Get a DDT by id' })
  async getDdt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getDdt(req.user.tenantId, id);
  }

  @Post('ddts/:id/issue')
  @ApiOperation({ summary: 'Issue the DDT (assign tracking + carrier)' })
  async issueDdt(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueDdtDto,
  ) {
    return this.svc.issueDdt(req.user.tenantId, id, dto);
  }

  @Post('ddts/:id/in-transit')
  @ApiOperation({ summary: 'Mark DDT as in transit (goods left warehouse)' })
  async ddtInTransit(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkInTransitDdtDto,
  ) {
    return this.svc.markDdtInTransit(req.user.tenantId, id, dto);
  }

  @Post('ddts/:id/delivered')
  @ApiOperation({ summary: 'Mark DDT as delivered' })
  async ddtDelivered(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkDeliveredDdtDto,
  ) {
    return this.svc.markDdtDelivered(req.user.tenantId, id, dto);
  }

  @Post('ddts/:id/cancel')
  @ApiOperation({ summary: 'Cancel a DDT (only before goods leave)' })
  async ddtCancel(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancelDdt(req.user.tenantId, id);
  }

  @Post('ddts/:id/return')
  @ApiOperation({ summary: 'Mark DDT as returned' })
  async ddtReturn(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.returnDdt(req.user.tenantId, id);
  }

  @Post('ddts/:id/lost')
  @ApiOperation({ summary: 'Mark DDT as lost' })
  async ddtLost(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.markDdtLost(req.user.tenantId, id);
  }

  @Post('ddts/:id/dispute')
  @ApiOperation({ summary: 'Mark DDT as disputed' })
  async ddtDispute(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.disputeDdt(req.user.tenantId, id);
  }

  @Post('ddts/prepare-invoice')
  @ApiOperation({
    summary:
      'Prepare an invoice payload from a set of DELIVERED DDTs (S15.5; fattura differita per DPR 633/1972 art. 21)',
  })
  async prepareInvoiceFromDdts(
    @Req() req: RequestWithUser,
    @Body() body: { ddtIds: string[] },
  ) {
    return this.svc.prepareInvoiceFromDdts(req.user.tenantId, body?.ddtIds ?? []);
  }

  @Post('ddts/:id/invoice')
  @ApiOperation({ summary: 'Bind a DDT to a created invoice id (S15.5)' })
  async bindDdtToInvoice(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { invoiceId: string },
  ) {
    return this.svc.invoiceDdt(req.user.tenantId, id, body.invoiceId);
  }

  // ─── ContactActivity (S15.3) ──────────────────────────────────

  @Post('activities')
  @ApiOperation({ summary: 'Log a contact activity' })
  async logActivity(
    @Req() req: RequestWithUser,
    @Body() dto: CreateContactActivityDto,
  ) {
    return this.svc.logActivity(req.user.tenantId, dto);
  }

  @Get('activities')
  @ApiOperation({ summary: 'List contact activities for the tenant' })
  async listActivities(
    @Req() req: RequestWithUser,
    @Query() query: ListContactActivityQueryDto,
  ) {
    return this.svc.listActivities(req.user.tenantId, query);
  }
}
