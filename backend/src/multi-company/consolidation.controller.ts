import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ConsolidationService } from './consolidation.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Multi-Company — Consolidation')
@ApiBearerAuth('JWT-auth')
@Controller('consolidation')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class ConsolidationController {
  constructor(private readonly svc: ConsolidationService) {}

  @Get('fiscal-year/:year')
  @ApiOperation({ summary: 'Per-Company + tenant rollup consolidation (S34).' })
  consolidate(
    @Req() req: RequestWithUser,
    @Param('year') year: string,
  ) {
    return this.svc.consolidate(req.user.tenantId, Number(year));
  }
}
