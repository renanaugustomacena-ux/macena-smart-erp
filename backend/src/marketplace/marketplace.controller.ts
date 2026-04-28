import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { MarketplaceService } from './marketplace.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Marketplace')
@ApiBearerAuth('JWT-auth')
@Controller('marketplace')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class MarketplaceController {
  constructor(private readonly svc: MarketplaceService) {}

  @Get('packages')
  @ApiOperation({ summary: 'Browse the marketplace catalogue (S37).' })
  list() {
    return this.svc.listPackages();
  }

  @Post('packages/:id/install')
  install(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { config?: Record<string, unknown> },
  ) {
    return this.svc.install(req.user.tenantId, id, body?.config ?? {});
  }

  @Get('installations')
  listInstallations(@Req() req: RequestWithUser) {
    return this.svc.listInstallations(req.user.tenantId);
  }

  @Post('installations/:id/cancel')
  cancel(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancel(req.user.tenantId, id);
  }
}
