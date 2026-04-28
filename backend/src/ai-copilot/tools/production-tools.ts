import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopilotTool } from '../tool-registry.service';
import { ReadModelRow } from '../../bi/entities/read-model-row.entity';
import { Ddt } from '../../sales/entities/ddt.entity';

const PERSONA = 'luca' as const;

/**
 * Production-persona Copilot tools (plan §31.2 Sprint 27 / S27.3).
 *
 * Tools are tenant-scoped + read-only in v1; mutations land alongside
 * the production-scheduling work in Sprint 29.
 */

@Injectable()
export class ExplainScrapSpikeTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'explain_scrap_spike',
    description:
      'Explain a recent scrap-rate spike — surfaces the work-orders, materials, and operators implicated in the past N days.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  };
  // v1 placeholder — the production module's scrap event stream lands
  // in Sprint 29; until then the tool returns a deterministic
  // "no-data" payload so the Copilot can phrase a graceful response.
  async execute(_tenantId: string, input: Record<string, unknown>) {
    return {
      lookbackDays: (input.days as number | undefined) ?? 7,
      events: [],
      note: 'Scrap event stream lands with the production-scheduling work (Sprint 29).',
    };
  }
}

@Injectable()
export class FindRootCauseTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'find_root_cause',
    description:
      'Walk the upstream WO + supplier chain for an article + flag candidate root causes.',
    input_schema: {
      type: 'object',
      properties: {
        articleSku: { type: 'string' },
        windowDays: { type: 'integer', minimum: 1, maximum: 30 },
      },
      required: ['articleSku'],
      additionalProperties: false,
    },
  };
  async execute(_tenantId: string, input: Record<string, unknown>) {
    return {
      articleSku: input.articleSku,
      candidates: [],
      note: 'Root-cause graph traversal lands with Sprint 29 (production scheduling).',
    };
  }
}

@Injectable()
export class WorkOrderThroughputTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'work_order_throughput',
    description:
      'Throughput of WOs (proxy: DDT throughput per month) for the period.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
        to: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const qb = this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'ddt_throughput' });
    if (input.from) qb.andWhere('r.key >= :f', { f: input.from });
    if (input.to) qb.andWhere('r.key < :t', { t: input.to });
    return qb.orderBy('r.key', 'ASC').limit(36).getMany();
  }
}

@Injectable()
export class DdtPipelineTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'ddt_pipeline',
    description: 'Inspect the DDT pipeline for the calling tenant.',
    input_schema: { type: 'object', additionalProperties: false },
  };
  constructor(
    @InjectRepository(Ddt)
    private readonly ddtRepo: Repository<Ddt>,
  ) {}
  async execute(tenantId: string) {
    return this.ddtRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.status NOT IN (:...closed)', {
        closed: ['delivered', 'invoiced', 'cancelled', 'returned', 'lost'],
      })
      .orderBy('d.issueDate', 'DESC')
      .limit(50)
      .getMany();
  }
}

@Injectable()
export class TopArticlesProducedTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'top_articles_produced',
    description:
      'Top articles in the inventory snapshot (proxy for current production focus).',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const limit = (input.limit as number | undefined) ?? 10;
    return this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'inventory_stock_snapshot' })
      .orderBy("(r.payload->>'quantity')::numeric", 'DESC')
      .limit(limit)
      .getMany();
  }
}

export const PRODUCTION_TOOL_PROVIDERS = [
  ExplainScrapSpikeTool,
  FindRootCauseTool,
  WorkOrderThroughputTool,
  DdtPipelineTool,
  TopArticlesProducedTool,
];
