import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { IntrastatService } from './intrastat.service';
import {
  CreateDraftDeclarationDto,
  ListDeclarationsQueryDto,
  RejectDeclarationDto,
  SubmitDeclarationDto,
} from './intrastat.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Intrastat')
@ApiBearerAuth('JWT-auth')
@Controller('intrastat')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class IntrastatController {
  constructor(private readonly svc: IntrastatService) {}

  @Get('declarations')
  @ApiOperation({ summary: 'List Intrastat declarations for the tenant' })
  async list(
    @Req() req: RequestWithUser,
    @Query() query: ListDeclarationsQueryDto,
  ) {
    return this.svc.listDeclarations(req.user.tenantId, query);
  }

  @Post('declarations')
  @ApiOperation({
    summary:
      'Create or fetch a DRAFT Intrastat declaration for {type, year, month}',
  })
  async createDraft(
    @Req() req: RequestWithUser,
    @Body() dto: CreateDraftDeclarationDto,
  ) {
    return this.svc.createOrFindDraft(
      req.user.tenantId,
      dto.type,
      dto.year,
      dto.month,
    );
  }

  @Get('declarations/:id')
  @ApiOperation({
    summary: 'Get an Intrastat declaration with its persisted lines',
  })
  async get(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getDeclaration(req.user.tenantId, id);
  }

  @Get('declarations/:id/preview')
  @ApiOperation({
    summary:
      'Preview the candidate aggregation for a draft declaration (S16.2)',
  })
  async preview(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const decl = await this.svc.getDeclaration(req.user.tenantId, id);
    const lines = await this.svc.aggregateLines(
      req.user.tenantId,
      decl.type,
      decl.periodYear,
      decl.periodMonth ?? 0,
    );
    return { declarationId: decl.id, lines };
  }

  @Post('declarations/:id/generate')
  @ApiOperation({
    summary: 'Aggregate + freeze lines on the declaration (transition: draft → generated)',
  })
  async generate(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.generate(req.user.tenantId, id, req.user.id);
  }

  @Post('declarations/:id/submit')
  @ApiOperation({
    summary: 'Mark declaration as submitted (with ADM protocollo)',
  })
  async submit(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitDeclarationDto,
  ) {
    return this.svc.submit(
      req.user.tenantId,
      id,
      dto.admProtocollo,
      req.user.id,
    );
  }

  @Post('declarations/:id/accept')
  @ApiOperation({ summary: 'Mark a submitted declaration as accepted' })
  async accept(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.accept(req.user.tenantId, id);
  }

  @Post('declarations/:id/reject')
  @ApiOperation({ summary: 'Mark a submitted declaration as rejected' })
  async reject(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDeclarationDto,
  ) {
    return this.svc.reject(req.user.tenantId, id, dto.reason);
  }

  @Post('declarations/:id/reopen')
  @ApiOperation({
    summary:
      'Re-open a generated declaration back to draft (lines are recomputed at next generate)',
  })
  async reopen(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.reopen(req.user.tenantId, id);
  }

  @Get('declarations/:id/export.csv')
  @ApiOperation({ summary: 'Export the declaration as ADM CSV' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @HttpCode(200)
  async exportCsv(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { filename, body } = await this.svc.exportCsv(req.user.tenantId, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(body);
  }

  @Get('declarations/:id/export.xml')
  @ApiOperation({ summary: 'Export the declaration as ADM XML' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @HttpCode(200)
  async exportXml(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { filename, body } = await this.svc.exportXml(req.user.tenantId, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(body);
  }
}
