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
import { WebhooksService } from './webhooks.service';
import { WebhookSubscriptionStatus } from './entities/webhook-subscription.entity';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Webhooks')
@ApiBearerAuth('JWT-auth')
@Controller('webhooks')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Post('subscriptions')
  @ApiOperation({
    summary:
      'Create a webhook subscription (S21.1) — returns the HMAC secret once.',
  })
  create(
    @Req() req: RequestWithUser,
    @Body() body: { eventType: string; targetUrl: string; hmacSecret?: string },
  ) {
    return this.svc.create(req.user.tenantId, body);
  }

  @Get('subscriptions')
  list(
    @Req() req: RequestWithUser,
    @Query('status') status?: WebhookSubscriptionStatus,
    @Query('eventType') eventType?: string,
  ) {
    return this.svc.list(req.user.tenantId, { status, eventType });
  }

  @Post('subscriptions/:id/pause')
  pause(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.pause(req.user.tenantId, id);
  }

  @Post('subscriptions/:id/resume')
  resume(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.resume(req.user.tenantId, id);
  }

  @Post('subscriptions/:id/disable')
  disable(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.disable(req.user.tenantId, id, body.reason);
  }

  @Get('dlq')
  @ApiOperation({ summary: 'List webhook DLQ entries (S21.2).' })
  listDlq(
    @Req() req: RequestWithUser,
    @Query('subscriptionId') subscriptionId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listDlq(req.user.tenantId, {
      subscriptionId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
