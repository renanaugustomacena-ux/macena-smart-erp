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
import { SalesPipelineService } from './sales-pipeline.service';
import {
  PipelineQueryDto,
  pipelineQueryDtoToFilters,
} from './sales-pipeline.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Sales (pipeline)')
@ApiBearerAuth('JWT-auth')
@Controller('sales/pipeline')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class SalesPipelineController {
  constructor(private readonly svc: SalesPipelineService) {}

  @Get()
  @ApiOperation({
    summary:
      'Sales pipeline snapshot (S16.1): per-customer deal stages with filter + drill-down hooks',
  })
  async getPipeline(
    @Req() req: RequestWithUser,
    @Query() query: PipelineQueryDto,
  ) {
    return this.svc.getPipeline(
      req.user.tenantId,
      pipelineQueryDtoToFilters(query),
    );
  }

  @Get('customers/:customerId/timeline')
  @ApiOperation({
    summary:
      'Per-customer drill-down timeline (S16.1): merged events across quotations, sales orders, DDTs, and contact activities',
  })
  async getCustomerTimeline(
    @Req() req: RequestWithUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.svc.getCustomerTimeline(req.user.tenantId, customerId);
  }
}
