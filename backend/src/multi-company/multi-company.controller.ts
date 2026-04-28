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
import { MultiCompanyService } from './multi-company.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Multi-Company')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class MultiCompanyController {
  constructor(private readonly svc: MultiCompanyService) {}

  @Get()
  @ApiOperation({ summary: 'List the companies (legal entities) under the tenant.' })
  list(@Req() req: RequestWithUser) {
    return this.svc.list(req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new company.' })
  create(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      code: string;
      name: string;
      vatNumber?: string;
      fiscalCode?: string;
      sdiDestinationCode?: string;
      pecEmail?: string;
      address?: Record<string, unknown>;
    },
  ) {
    return this.svc.create(req.user.tenantId, body);
  }

  @Post(':id/set-primary')
  setPrimary(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.setPrimary(req.user.tenantId, id);
  }
}
