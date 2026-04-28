import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CashForecastService } from './cash-forecast.service';
import { AutoReconcilerService } from './auto-reconciler.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Treasury — Forecast + Auto-Reconcile')
@ApiBearerAuth('JWT-auth')
@Controller('treasury')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class CashForecastController {
  constructor(
    private readonly forecast: CashForecastService,
    private readonly reconciler: AutoReconcilerService,
  ) {}

  @Get('forecast')
  @ApiOperation({ summary: '30/60/90-day cash forecast (S32).' })
  list(@Req() req: RequestWithUser) {
    return this.forecast.forecast(req.user.tenantId);
  }

  @Get('reconciliation/proposals')
  @ApiOperation({ summary: 'Auto-reconcile proposals (S32).' })
  propose(@Req() req: RequestWithUser) {
    return this.reconciler.propose(req.user.tenantId);
  }
}
