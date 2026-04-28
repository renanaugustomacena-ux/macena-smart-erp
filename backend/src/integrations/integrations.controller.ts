import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ConnectorRegistry } from './connector-registry.service';
import {
  ConnectorContext,
  ConnectorMode,
} from './connectors/connector.contract';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Integrations')
@ApiBearerAuth('JWT-auth')
@Controller('integrations')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class IntegrationsController {
  constructor(private readonly registry: ConnectorRegistry) {}

  @Get('connectors')
  list() {
    return this.registry.list().map((c) => ({
      id: c.id,
      description: c.description,
      source: c.source,
    }));
  }

  @Get('connectors/:id/health')
  @ApiOperation({ summary: 'Healthcheck a connector for the current tenant.' })
  health(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body?: { mode?: ConnectorMode; credentials?: Record<string, string> },
  ) {
    const c = this.registry.get(id);
    const ctx: ConnectorContext = {
      tenantId: req.user.tenantId,
      mode: body?.mode ?? 'sandbox',
      credentials: body?.credentials ?? {},
    };
    return c.healthcheck(ctx);
  }

  @Post('connectors/:id/sync')
  @ApiOperation({
    summary:
      'Trigger an inbound sync for a connector (sandbox by default; production lands in Sprint 24).',
  })
  sync(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body?: { mode?: ConnectorMode; credentials?: Record<string, string> },
  ) {
    const c = this.registry.get(id);
    const ctx: ConnectorContext = {
      tenantId: req.user.tenantId,
      mode: body?.mode ?? 'sandbox',
      credentials: body?.credentials ?? {},
    };
    return c.syncIncoming(ctx);
  }
}
