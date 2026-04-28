import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReportDefinition,
  ReportSchedule,
  ReportScheduleChannel,
  ReportScheduleFormat,
  ReportScheduleStatus,
} from './entities/report-definition.entity';
import {
  DASHBOARD_CATALOG,
  DashboardManifest,
  DashboardPersona,
} from './dashboards/dashboards.catalog';
import { ProjectionOrchestrator } from './projection.orchestrator';
import { ReadModelRow } from './entities/read-model-row.entity';

export interface CreateReportDefinitionInput {
  name: string;
  description?: string;
  body: Record<string, unknown>;
}

export interface CreateScheduleInput {
  reportDefinitionId: string;
  cronExpression: string;
  timezone?: string;
  channel: ReportScheduleChannel;
  recipients: string[];
  format: ReportScheduleFormat;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportDefinition)
    private readonly reportRepo: Repository<ReportDefinition>,
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
    private readonly orchestrator: ProjectionOrchestrator,
  ) {}

  // ─── Dashboards ──────────────────────────────────────────

  listDashboards(persona?: DashboardPersona): DashboardManifest[] {
    if (!persona) return [...DASHBOARD_CATALOG];
    return DASHBOARD_CATALOG.filter((d) => d.persona === persona);
  }

  getDashboard(id: string): DashboardManifest {
    const d = DASHBOARD_CATALOG.find((x) => x.id === id);
    if (!d) throw new NotFoundException(`Dashboard '${id}' not found`);
    return d;
  }

  async resolveDashboardData(
    tenantId: string,
    dashboardId: string,
  ): Promise<{
    dashboard: DashboardManifest;
    widgets: Array<{
      widgetId: string;
      projectionId: string;
      rows: ReadModelRow[];
    }>;
  }> {
    const d = this.getDashboard(dashboardId);
    const widgets = await Promise.all(
      d.widgets.map(async (w) => ({
        widgetId: w.id,
        projectionId: w.projectionId,
        rows: await this.orchestrator.listRows(
          tenantId,
          w.projectionId,
          w.keyPrefix,
          w.limit ?? 1000,
        ),
      })),
    );
    return { dashboard: d, widgets };
  }

  // ─── ReportDefinition CRUD ───────────────────────────────

  async createReport(
    tenantId: string,
    actorUserId: string,
    dto: CreateReportDefinitionInput,
  ): Promise<ReportDefinition> {
    const dup = await this.reportRepo.findOne({
      where: { tenantId, name: dto.name },
    });
    if (dup) {
      throw new ConflictException(
        `Report definition '${dto.name}' already exists in tenant`,
      );
    }
    const entity = this.reportRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      createdBy: actorUserId,
      body: dto.body,
      isActive: true,
    });
    return this.reportRepo.save(entity);
  }

  async listReports(tenantId: string): Promise<ReportDefinition[]> {
    return this.reportRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.isActive = true')
      .orderBy('r.name', 'ASC')
      .getMany();
  }

  async getReport(tenantId: string, id: string): Promise<ReportDefinition> {
    const r = await this.reportRepo.findOne({ where: { tenantId, id } });
    if (!r) throw new NotFoundException(`Report ${id} not found`);
    return r;
  }

  async updateReport(
    tenantId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<ReportDefinition> {
    const r = await this.getReport(tenantId, id);
    r.body = body;
    return this.reportRepo.save(r);
  }

  async deleteReport(tenantId: string, id: string): Promise<void> {
    const r = await this.getReport(tenantId, id);
    r.isActive = false;
    await this.reportRepo.save(r);
  }

  // ─── ReportSchedule CRUD ─────────────────────────────────

  async createSchedule(
    tenantId: string,
    actorUserId: string,
    dto: CreateScheduleInput,
  ): Promise<ReportSchedule> {
    if (!dto.recipients || dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }
    if (!isValidCron(dto.cronExpression)) {
      throw new BadRequestException(
        `Invalid cron expression '${dto.cronExpression}' — expected 5 space-separated fields`,
      );
    }
    const definition = await this.getReport(tenantId, dto.reportDefinitionId);
    const entity = this.scheduleRepo.create({
      tenantId,
      reportDefinitionId: definition.id,
      cronExpression: dto.cronExpression,
      timezone: dto.timezone ?? 'UTC',
      channel: dto.channel,
      recipients: dto.recipients,
      format: dto.format,
      status: 'active',
      nextRunAt: nextRunAt(dto.cronExpression),
      createdBy: actorUserId,
    });
    return this.scheduleRepo.save(entity);
  }

  async listSchedules(
    tenantId: string,
    filters: {
      status?: ReportScheduleStatus;
      reportDefinitionId?: string;
    } = {},
  ): Promise<ReportSchedule[]> {
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });
    if (filters.status)
      qb.andWhere('s.status = :status', { status: filters.status });
    if (filters.reportDefinitionId)
      qb.andWhere('s.reportDefinitionId = :rid', {
        rid: filters.reportDefinitionId,
      });
    return qb.orderBy('s.nextRunAt', 'ASC').getMany();
  }

  async pauseSchedule(
    tenantId: string,
    id: string,
  ): Promise<ReportSchedule> {
    const s = await this.scheduleRepo.findOne({ where: { tenantId, id } });
    if (!s) throw new NotFoundException(`Schedule ${id} not found`);
    s.status = 'paused';
    return this.scheduleRepo.save(s);
  }

  async resumeSchedule(
    tenantId: string,
    id: string,
  ): Promise<ReportSchedule> {
    const s = await this.scheduleRepo.findOne({ where: { tenantId, id } });
    if (!s) throw new NotFoundException(`Schedule ${id} not found`);
    s.status = 'active';
    s.nextRunAt = nextRunAt(s.cronExpression);
    return this.scheduleRepo.save(s);
  }
}

function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5;
}

function nextRunAt(_cronExpression: string): Date {
  // Coarse approximation for v1: schedule the next run 24h from now;
  // the production scheduler (BullMQ + cron-parser) lands in Sprint 19
  // alongside the PWA worker infrastructure. Keeping this simple for
  // contract testing — see `scheduler.spec.ts` for the validator
  // around it.
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
