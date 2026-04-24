import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Header,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { AccountingService } from './accounting.service';
import { AccountType, InvoiceStatus } from './accounting.entity';
import {
  CreateAccountDto,
  CreateInvoiceDto,
  CreateJournalEntryDto,
} from './accounting.dto';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('Accounting')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ─── Chart of Accounts ─────────────────────────────────────────

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a chart-of-accounts entry' })
  async createAccount(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountingService.createAccount(req.user.tenantId, dto);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List chart-of-accounts entries' })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  async listAccounts(
    @Request() req: { user: { tenantId: string } },
    @Query('type') type?: AccountType,
  ) {
    return this.accountingService.listAccounts(req.user.tenantId, type);
  }

  @Post('accounts/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Seed the Piano dei Conti IV Direttiva CEE template (idempotent)',
  })
  async seedAccounts(@Request() req: { user: { tenantId: string } }) {
    const created = await this.accountingService.seedChartOfAccounts(
      req.user.tenantId,
    );
    return { created, message: `${created} accounts seeded` };
  }

  // ─── Journal Entries (Prima Nota) ──────────────────────────────

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a journal entry (registro prima nota)' })
  async createEntry(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accountingService.createJournalEntry(req.user.tenantId, dto);
  }

  @Get('entries')
  @ApiOperation({ summary: 'List journal entries filtered by date range' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listEntries(
    @Request() req: { user: { tenantId: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.accountingService.listJournalEntries(req.user.tenantId, {
      from,
      to,
      page,
      limit,
    });
  }

  // ─── Invoices (FatturaPA) ──────────────────────────────────────

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft electronic invoice (FatturaPA)' })
  async createInvoice(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.accountingService.createInvoice(req.user.tenantId, dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices with status and period filters' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'fiscalYear', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listInvoices(
    @Request() req: { user: { tenantId: string } },
    @Query('status') status?: InvoiceStatus,
    @Query('fiscalYear') fiscalYear?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.accountingService.listInvoices(req.user.tenantId, {
      status,
      fiscalYear,
      page,
      limit,
    });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 404, description: 'Invoice not found or cross-tenant' })
  async getInvoice(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.getInvoice(req.user.tenantId, id);
  }

  @Get('invoices/:id/fatturapa.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({
    summary: 'Generate the FatturaPA v1.2.2 XML body for a given invoice',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'FatturaPA XML body' })
  @ApiResponse({ status: 404, description: 'Invoice or related data missing' })
  async generateFatturaPaXml(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { xml } = await this.accountingService.generateFatturaPaXml(
      req.user.tenantId,
      id,
    );
    return xml;
  }

  @Patch('invoices/:id/accept')
  @ApiOperation({
    summary:
      'Mark invoice ACCEPTED and auto-post double-entry journal (Crediti v/Clienti / Ricavi / IVA a debito)',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async acceptInvoice(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.acceptInvoice(req.user.tenantId, id);
  }

  @Patch('invoices/:id/submit')
  @ApiOperation({
    summary:
      'Queue invoice for SDI submission via accredited intermediary',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async submitInvoice(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.queueInvoiceForSdi(req.user.tenantId, id);
  }

  // ─── IVA Liquidation ───────────────────────────────────────────

  @Get('iva-liquidation')
  @ApiOperation({ summary: 'Generate IVA liquidation summary for a period' })
  @ApiQuery({
    name: 'period',
    required: true,
    description:
      'YYYY-MM for monthly or YYYY-Q1/Q2/Q3/Q4 for quarterly (liquidazione periodica DPR 633/1972)',
  })
  async ivaLiquidation(
    @Request() req: { user: { tenantId: string } },
    @Query('period') period: string,
  ) {
    return this.accountingService.ivaLiquidation(req.user.tenantId, period);
  }
}
