import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommercialistaService } from './commercialista.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

/**
 * CommercialistaController — Andrea Portal v1 (S16.3, plan §3.1.5).
 *
 * No `TenantScopeGuard` here: the cockpit is, by design, cross-tenant.
 * Authorisation is per-tenant inside the service via Membership lookup.
 */
@ApiTags('Commercialista Portal')
@ApiBearerAuth('JWT-auth')
@Controller('commercialista')
@UseGuards(AuthGuard('jwt'))
export class CommercialistaController {
  constructor(private readonly svc: CommercialistaService) {}

  @Get('tenants')
  @ApiOperation({
    summary:
      'List client tenants where the calling user holds an active commercialista membership',
  })
  async listTenants(@Req() req: RequestWithUser) {
    return this.svc.listAssignedTenants(req.user.id);
  }

  @Get('tenants/:tenantId/snapshot')
  @ApiOperation({
    summary:
      'Per-tenant snapshot for the commercialista cockpit (S16.3): invoices, supplier invoices, IVA period, pipeline, recent Intrastat, deadlines',
  })
  async getSnapshot(
    @Req() req: RequestWithUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.svc.getSnapshot(req.user.id, tenantId);
  }
}
