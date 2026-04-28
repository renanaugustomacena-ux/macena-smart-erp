import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { ProjectionOrchestrator } from './projection.orchestrator';
import { ProjectionRegistry } from './projection-registry.service';
import { ReportService } from './report.service';
import {
  ReportExportFormat,
  ReportExporterService,
} from './report-exporter.service';
import { DashboardPersona } from './dashboards/dashboards.catalog';
import { ReportScheduleStatus } from './entities/report-definition.entity';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('BI / Reporting')
@ApiBearerAuth('JWT-auth')
@Controller('bi')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class BiController {
  constructor(
    private readonly registry: ProjectionRegistry,
    private readonly orchestrator: ProjectionOrchestrator,
    private readonly reportSvc: ReportService,
    private readonly exporter: ReportExporterService,
  ) {}

  // ─── Projections ────────────────────────────────────────

  @Get('projections')
  @ApiOperation({ summary: 'List registered CQRS projections' })
  listProjections() {
    return this.registry.list().map((p) => ({
      id: p.id,
      description: p.description,
      source: p.source,
    }));
  }

  @Post('projections/:id/run')
  @ApiOperation({
    summary: 'Run a projection for the calling tenant (full refresh).',
  })
  runProjection(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { fromTimestamp?: string; toTimestamp?: string },
  ) {
    return this.orchestrator.run(
      req.user.tenantId,
      id,
      body?.fromTimestamp ? new Date(body.fromTimestamp) : null,
      body?.toTimestamp ? new Date(body.toTimestamp) : null,
    );
  }

  @Post('projections/run-all')
  @ApiOperation({
    summary: 'Run every registered projection for the calling tenant.',
  })
  runAll(
    @Req() req: RequestWithUser,
    @Body() body: { fromTimestamp?: string; toTimestamp?: string },
  ) {
    return this.orchestrator.runAll(
      req.user.tenantId,
      body?.fromTimestamp ? new Date(body.fromTimestamp) : null,
      body?.toTimestamp ? new Date(body.toTimestamp) : null,
    );
  }

  @Get('projections/:id/cursor')
  @ApiOperation({ summary: 'Get the per-tenant cursor for a projection.' })
  async getCursor(@Req() req: RequestWithUser, @Param('id') id: string) {
    return (await this.orchestrator.getCursor(req.user.tenantId, id)) ?? null;
  }

  @Get('projections/:id/rows')
  @ApiOperation({ summary: 'List read-model rows for a projection.' })
  listRows(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('keyPrefix') keyPrefix?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orchestrator.listRows(
      req.user.tenantId,
      id,
      keyPrefix,
      limit ? Number(limit) : 1000,
    );
  }

  // ─── Dashboards ─────────────────────────────────────────

  @Get('dashboards')
  @ApiOperation({ summary: 'List dashboards (optionally filtered by persona).' })
  listDashboards(@Query('persona') persona?: DashboardPersona) {
    return this.reportSvc.listDashboards(persona);
  }

  @Get('dashboards/:id')
  @ApiOperation({ summary: 'Get dashboard manifest by id.' })
  getDashboard(@Param('id') id: string) {
    return this.reportSvc.getDashboard(id);
  }

  @Get('dashboards/:id/data')
  @ApiOperation({
    summary: 'Resolve dashboard widgets to their current read-model rows.',
  })
  async getDashboardData(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.reportSvc.resolveDashboardData(req.user.tenantId, id);
  }

  @Get('dashboards/:id/export')
  @ApiOperation({ summary: 'Export a dashboard as CSV / XLSX / PDF (S18.5).' })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async exportDashboard(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('format') format: ReportExportFormat = 'pdf',
    @Res() res: Response,
  ) {
    const data = await this.reportSvc.resolveDashboardData(
      req.user.tenantId,
      id,
    );
    const out = this.exporter.export({
      dashboard: data.dashboard,
      widgets: data.widgets,
      format,
    });
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    res.send(out.body);
  }

  // ─── ReportDefinition CRUD ──────────────────────────────

  @Post('reports')
  createReport(
    @Req() req: RequestWithUser,
    @Body() body: { name: string; description?: string; body: Record<string, unknown> },
  ) {
    return this.reportSvc.createReport(req.user.tenantId, req.user.id, {
      name: body.name,
      description: body.description,
      body: body.body,
    });
  }

  @Get('reports')
  listReports(@Req() req: RequestWithUser) {
    return this.reportSvc.listReports(req.user.tenantId);
  }

  @Get('reports/:id')
  getReport(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportSvc.getReport(req.user.tenantId, id);
  }

  @Put('reports/:id')
  updateReport(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { body: Record<string, unknown> },
  ) {
    return this.reportSvc.updateReport(req.user.tenantId, id, body.body);
  }

  @Delete('reports/:id')
  async deleteReport(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.reportSvc.deleteReport(req.user.tenantId, id);
    return { ok: true };
  }

  // ─── ReportSchedule CRUD ───────────────────────────────

  @Post('schedules')
  createSchedule(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      reportDefinitionId: string;
      cronExpression: string;
      timezone?: string;
      channel: 'email' | 'pec';
      recipients: string[];
      format: ReportExportFormat;
    },
  ) {
    return this.reportSvc.createSchedule(req.user.tenantId, req.user.id, body);
  }

  @Get('schedules')
  listSchedules(
    @Req() req: RequestWithUser,
    @Query('status') status?: ReportScheduleStatus,
    @Query('reportDefinitionId') reportDefinitionId?: string,
  ) {
    return this.reportSvc.listSchedules(req.user.tenantId, {
      status,
      reportDefinitionId,
    });
  }

  @Post('schedules/:id/pause')
  pauseSchedule(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportSvc.pauseSchedule(req.user.tenantId, id);
  }

  @Post('schedules/:id/resume')
  resumeSchedule(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportSvc.resumeSchedule(req.user.tenantId, id);
  }
}
