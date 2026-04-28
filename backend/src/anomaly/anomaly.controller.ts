import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { AnomalyService } from './anomaly.service';
import { ComplianceReasonerService } from './compliance-reasoner.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Anomaly + Compliance Reasoner')
@ApiBearerAuth('JWT-auth')
@Controller('anomaly')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class AnomalyController {
  constructor(
    private readonly svc: AnomalyService,
    private readonly reasoner: ComplianceReasonerService,
  ) {}

  @Get('detect')
  @ApiOperation({ summary: 'Z-score anomaly detection over a BI projection.' })
  detect(
    @Req() req: RequestWithUser,
    @Query('projectionId') projectionId: string,
    @Query('field') field: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.svc.detect(
      req.user.tenantId,
      projectionId,
      field,
      threshold ? Number(threshold) : 2,
    );
  }

  @Post('compliance/reason')
  @ApiOperation({ summary: 'Static-rule compliance reasoner over a snapshot input.' })
  reason(
    @Body()
    input: {
      invoicesLast30Days: number;
      supplierInvoicesLast30Days: number;
      intrastatDeclarationsLast90Days: number;
      conservazioneVersamentiLast30Days: number;
      ssoConfigured: boolean;
      breakGlassEmailRotatedDaysAgo: number | null;
    },
  ) {
    return this.reasoner.reason(input);
  }
}
