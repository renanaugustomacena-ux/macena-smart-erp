import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { IntrastatDeclaration } from '../../intrastat/entities/intrastat-declaration.entity';

/**
 * intrastat_monthly_summary — INTRA-1bis + INTRA-2bis per month.
 * Key = `YYYY-MM`. Payload = { cessioniValueCents, cessioniLines,
 * acquistiValueCents, acquistiLines, statuses }.
 */
@Injectable()
export class IntrastatMonthlySummaryProjection implements Projection {
  readonly id = 'intrastat_monthly_summary';
  readonly description =
    'INTRA-1bis + INTRA-2bis monthly summary: per-period totals, line counts, status mix.';
  readonly source = 'mixed' as const;

  constructor(
    @InjectRepository(IntrastatDeclaration)
    private readonly intrastatRepo: Repository<IntrastatDeclaration>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.intrastatRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId: ctx.tenantId });
    const rows = await qb.getMany();

    const m = new Map<
      string,
      {
        cessioniValueCents: number;
        cessioniLines: number;
        acquistiValueCents: number;
        acquistiLines: number;
        statuses: Record<string, number>;
      }
    >();
    for (const r of rows) {
      if (!r.periodMonth) continue;
      const key = `${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`;
      const cur = m.get(key) ?? {
        cessioniValueCents: 0,
        cessioniLines: 0,
        acquistiValueCents: 0,
        acquistiLines: 0,
        statuses: {},
      };
      if (r.type === 'cessioni') {
        cur.cessioniValueCents += Number(r.totalValueCents ?? 0);
        cur.cessioniLines += r.lineCount;
      } else {
        cur.acquistiValueCents += Number(r.totalValueCents ?? 0);
        cur.acquistiLines += r.lineCount;
      }
      cur.statuses[r.status] = (cur.statuses[r.status] ?? 0) + 1;
      m.set(key, cur);
    }
    return {
      rows: Array.from(m.entries())
        .map(([key, payload]) => ({ key, payload }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
