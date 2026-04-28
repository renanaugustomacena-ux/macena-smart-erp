import {
  Controller,
  Get,
  Header,
  HttpCode,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ComplianceService } from './compliance.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Compliance')
@ApiBearerAuth('JWT-auth')
@Controller('compliance')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  @Get('nis2/pack')
  @ApiOperation({
    summary:
      'Download the NIS2 Compliance Pack as a PDF (S20.1, D.Lgs. 138/2024).',
  })
  @Header('Content-Type', 'application/pdf')
  @HttpCode(200)
  async downloadNis2(@Req() req: RequestWithUser, @Res() res: Response) {
    const out = await this.svc.generateNis2Pack(req.user.tenantId);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('Content-Type', out.contentType);
    res.send(out.body);
  }

  @Get('security/pack')
  @ApiOperation({
    summary:
      'Download the per-tenant security pack as a PDF (S20.5).',
  })
  @Header('Content-Type', 'application/pdf')
  @HttpCode(200)
  async downloadSecurity(@Req() req: RequestWithUser, @Res() res: Response) {
    const out = await this.svc.generateSecurityPack(req.user.tenantId);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    res.setHeader('Content-Type', out.contentType);
    res.send(out.body);
  }

  @Get('audit')
  @ApiOperation({
    summary: 'List recent audit-log rows (audit-explorer feed; S20.4).',
  })
  async listAudit(
    @Req() req: RequestWithUser,
    @Query('action') action?: string,
    @Query('outcome') outcome?: 'success' | 'failure' | 'denied',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listAuditTrail(req.user.tenantId, {
      action,
      outcome,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
