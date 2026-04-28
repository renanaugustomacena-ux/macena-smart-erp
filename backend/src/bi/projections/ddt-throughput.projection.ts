import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { Ddt } from '../../sales/entities/ddt.entity';

/**
 * ddt_throughput — DDTs grouped by month + status.
 * Key = `YYYY-MM`. Payload = per-status counts.
 */
@Injectable()
export class DdtThroughputProjection implements Projection {
  readonly id = 'ddt_throughput';
  readonly description =
    'DDT throughput per month (counts grouped by status).';
  readonly source = 'sales_orders' as const;

  constructor(
    @InjectRepository(Ddt)
    private readonly ddtRepo: Repository<Ddt>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.ddtRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('d.issueDate >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp)
      qb.andWhere('d.issueDate < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const d = new Date(r.issueDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = m.get(key) ?? {};
      cur[r.status] = (cur[r.status] ?? 0) + 1;
      cur.total = (cur.total ?? 0) + 1;
      m.set(key, cur);
    }
    return {
      rows: Array.from(m.entries())
        .map(([key, payload]) => ({ key, payload }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
