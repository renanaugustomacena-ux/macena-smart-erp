import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ForecastingService } from './forecasting.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Forecasting')
@ApiBearerAuth('JWT-auth')
@Controller('forecasting')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class ForecastingController {
  constructor(private readonly svc: ForecastingService) {}

  @Get('skus/:productId')
  @ApiOperation({ summary: 'Per-SKU demand forecast (v1: moving-average baseline).' })
  forecast(
    @Req() req: RequestWithUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('horizonDays') horizonDays?: string,
  ) {
    return this.svc.forecastSku(
      req.user.tenantId,
      productId,
      horizonDays ? Number(horizonDays) : 30,
    );
  }

  @Get('reorder-suggestions')
  @ApiOperation({ summary: 'Reorder suggestions across the tenant catalogue.' })
  listReorder(
    @Req() req: RequestWithUser,
    @Query('threshold') threshold?: string,
  ) {
    return this.svc.listReorderSuggestions(
      req.user.tenantId,
      threshold ? Number(threshold) : 0,
    );
  }
}
