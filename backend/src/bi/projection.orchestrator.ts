import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ProjectionCursor,
  ReadModelRow,
} from './entities/read-model-row.entity';
import { ProjectionRegistry } from './projection-registry.service';
import {
  ProjectionContext,
  ProjectionRunResult,
} from './projection.contract';

export interface RunProjectionResult {
  projectionId: string;
  rowsProjected: number;
  cursorAt: string | null;
  durationMs: number;
}

/**
 * ProjectionOrchestrator — runs a projection by id for a tenant + a
 * time window, then upserts the rows into `read_model_rows` and
 * advances the per-projection cursor (plan §31.1 Sprint 18 / S18.2).
 */
@Injectable()
export class ProjectionOrchestrator {
  private readonly logger = new Logger(ProjectionOrchestrator.name);

  constructor(
    private readonly registry: ProjectionRegistry,
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
    @InjectRepository(ProjectionCursor)
    private readonly cursorRepo: Repository<ProjectionCursor>,
    private readonly dataSource: DataSource,
  ) {}

  async run(
    tenantId: string,
    projectionId: string,
    fromTimestamp: Date | null = null,
    toTimestamp: Date | null = null,
  ): Promise<RunProjectionResult> {
    const projection = this.registry.get(projectionId);
    const start = Date.now();

    // Load + mark the cursor as running (best-effort; failures must not
    // crash the worker).
    let cursor = await this.cursorRepo.findOne({
      where: { tenantId, projectionId },
    });
    if (!cursor) {
      cursor = this.cursorRepo.create({
        tenantId,
        projectionId,
        status: 'running',
        rowsProjected: 0,
      });
    } else {
      cursor.status = 'running';
      cursor.lastError = null;
    }
    await this.cursorRepo.save(cursor);

    let result: ProjectionRunResult;
    try {
      const ctx: ProjectionContext = {
        tenantId,
        fromTimestamp,
        toTimestamp,
      };
      result = await projection.run(ctx);
    } catch (err) {
      cursor.status = 'failed';
      cursor.lastError = err instanceof Error ? err.message : String(err);
      await this.cursorRepo.save(cursor);
      throw err;
    }

    await this.upsertRows(tenantId, projectionId, result);

    const cursorAt = result.cursorAt ?? toTimestamp ?? new Date();
    cursor.lastProcessedAt = cursorAt;
    cursor.rowsProjected = result.rows.length;
    cursor.status = 'idle';
    cursor.lastError = null;
    await this.cursorRepo.save(cursor);

    return {
      projectionId,
      rowsProjected: result.rows.length,
      cursorAt: cursorAt.toISOString(),
      durationMs: Date.now() - start,
    };
  }

  async runAll(
    tenantId: string,
    fromTimestamp: Date | null = null,
    toTimestamp: Date | null = null,
  ): Promise<RunProjectionResult[]> {
    const results: RunProjectionResult[] = [];
    for (const p of this.registry.list()) {
      try {
        results.push(await this.run(tenantId, p.id, fromTimestamp, toTimestamp));
      } catch (err) {
        this.logger.error({
          event: 'bi.projection.failed',
          tenantId,
          projectionId: p.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  async listRows(
    tenantId: string,
    projectionId: string,
    keyPrefix?: string,
    limit = 1000,
  ): Promise<ReadModelRow[]> {
    const qb = this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :projectionId', { projectionId });
    if (keyPrefix) qb.andWhere('r.key LIKE :prefix', { prefix: `${keyPrefix}%` });
    return qb.orderBy('r.key', 'ASC').limit(limit).getMany();
  }

  async getCursor(
    tenantId: string,
    projectionId: string,
  ): Promise<ProjectionCursor | null> {
    return this.cursorRepo.findOne({ where: { tenantId, projectionId } });
  }

  // ─── Implementation ───────────────────────────────────────

  private async upsertRows(
    tenantId: string,
    projectionId: string,
    result: ProjectionRunResult,
  ): Promise<void> {
    if (result.rows.length === 0) return;
    await this.dataSource.transaction(async (manager) => {
      // Delete previous rows for this (tenant, projectionId) — full
      // refresh semantics for v1. Incremental upsert is left as a
      // future optimisation per ADR-010.
      await manager.delete(ReadModelRow, { tenantId, projectionId });
      const entities = result.rows.map((r) =>
        manager.create(ReadModelRow, {
          tenantId,
          projectionId,
          key: r.key,
          payload: r.payload,
          version: 1,
        }),
      );
      // chunked save to avoid 64k parameter limits.
      const chunkSize = 500;
      for (let i = 0; i < entities.length; i += chunkSize) {
        await manager.save(entities.slice(i, i + chunkSize));
      }
    });
  }
}
