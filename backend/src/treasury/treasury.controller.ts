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
import { TreasuryService } from './treasury.service';
import {
  BankAccountStatus,
  Psd2Provider,
} from './entities/bank-account.entity';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Treasury')
@ApiBearerAuth('JWT-auth')
@Controller('treasury')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class TreasuryController {
  constructor(private readonly svc: TreasuryService) {}

  @Post('accounts')
  @ApiOperation({ summary: 'Create a bank account (IBAN encrypted at rest).' })
  createAccount(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      iban: string;
      bicSwift?: string;
      bankName?: string;
      psd2Provider?: Psd2Provider;
      currency?: string;
    },
  ) {
    return this.svc.createAccount(req.user.tenantId, body);
  }

  @Get('accounts')
  listAccounts(
    @Req() req: RequestWithUser,
    @Query('status') status?: BankAccountStatus,
  ) {
    return this.svc.listAccounts(req.user.tenantId, { status });
  }

  @Get('accounts/:id')
  getAccount(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getAccount(req.user.tenantId, id);
  }

  @Post('accounts/:id/sync')
  @ApiOperation({
    summary:
      'Trigger a PSD2 sync (sandbox by default; production wiring lands in Sprint 31).',
  })
  syncAccount(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { mode?: 'sandbox' | 'production' },
  ) {
    return this.svc.syncPsd2(
      req.user.tenantId,
      id,
      body?.mode ?? 'sandbox',
    );
  }

  @Get('reconciliation/unmatched')
  listUnmatched(
    @Req() req: RequestWithUser,
    @Query('accountId') accountId?: string,
  ) {
    return this.svc.listUnmatched(req.user.tenantId, accountId);
  }

  @Post('reconciliation/:txId/match')
  @ApiOperation({ summary: 'Manually match a bank transaction to an invoice / SI (S23.3).' })
  match(
    @Req() req: RequestWithUser,
    @Param('txId', ParseUUIDPipe) txId: string,
    @Body() body: { documentType: string; documentId: string },
  ) {
    return this.svc.manualMatch(req.user.tenantId, txId, req.user.id, body);
  }

  @Post('reconciliation/:txId/ignore')
  ignore(
    @Req() req: RequestWithUser,
    @Param('txId', ParseUUIDPipe) txId: string,
  ) {
    return this.svc.ignore(req.user.tenantId, txId, req.user.id);
  }
}
