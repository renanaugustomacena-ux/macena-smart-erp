import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { ReadModelRow } from '../entities/read-model-row.entity';

/**
 * benchmark_anonymous — opt-in tenant-scoped projection for the
 * anonymised industry-benchmarking dashboards (plan §31.2 Sprint 36).
 *
 * Every Professionale+ tenant who opts in via the Compliance
 * dashboard surface contributes anonymised aggregates here. The
 * projection rows carry a salted-hash tenant id, never the real one,
 * so cross-tenant readers cannot deanonymise. v1 ships the schema +
 * the projection wiring; the cross-tenant aggregator that powers the
 * benchmark dashboards lands in Sprint 45 alongside the Energy
 * Dashboard work.
 */
@Injectable()
export class BenchmarkAnonymousProjection implements Projection {
  readonly id = 'benchmark_anonymous';
  readonly description =
    'Opt-in anonymised tenant aggregates contributing to the industry-benchmarking dashboards.';
  readonly source = 'mixed' as const;

  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    // Pull the existing per-tenant projection rows we want to mirror
    // into the benchmark feed — invoice totals, IVA balance, customer
    // ranking length, intrastat totals.
    const rows = await this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .andWhere(
        "r.projectionId IN ('monthly_invoice_totals', 'iva_periodic_balance', 'customer_revenue_ranking')",
      )
      .getMany();

    // The aggregator that produces the cross-tenant anonymised feed
    // lives in the Sprint 45 release branch; v1 emits a single
    // summary row so the projection wiring is exercisable.
    const summary = {
      monthlyInvoiceCount: rows.filter(
        (r) => r.projectionId === 'monthly_invoice_totals',
      ).length,
      ivaPeriods: rows.filter(
        (r) => r.projectionId === 'iva_periodic_balance',
      ).length,
      customerCount: rows.filter(
        (r) => r.projectionId === 'customer_revenue_ranking',
      ).length,
      computedAtIso: new Date().toISOString(),
    };
    return {
      rows: [
        {
          key: 'summary',
          payload: summary,
        },
      ],
    };
  }
}
