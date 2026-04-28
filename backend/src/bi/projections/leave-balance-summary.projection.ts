import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { LeaveRequest } from '../../hr/entities/leave-request.entity';

/**
 * leave_balance_summary — approved-leave totals per employee per type.
 * Key = `<employeeId>:<leaveType>`. Payload = { approvedDays,
 * pendingDays, lastDecisionAt }.
 */
@Injectable()
export class LeaveBalanceSummaryProjection implements Projection {
  readonly id = 'leave_balance_summary';
  readonly description =
    'Per-employee leave balance by type (approved + pending days).';
  readonly source = 'leave_requests' as const;

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.leaveRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('r.startDate >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp)
      qb.andWhere('r.endDate < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<
      string,
      { approvedDays: number; pendingDays: number; lastDecisionAt: string }
    >();
    for (const r of rows) {
      const key = `${r.employeeId}:${r.leaveType}`;
      const cur = m.get(key) ?? {
        approvedDays: 0,
        pendingDays: 0,
        lastDecisionAt: '',
      };
      const days = Number(r.daysRequested ?? 0);
      if (r.status === 'approved') cur.approvedDays += days;
      else if (r.status === 'submitted' || r.status === 'draft')
        cur.pendingDays += days;
      const at = (r.decidedAt ?? r.updatedAt) instanceof Date
        ? (r.decidedAt ?? r.updatedAt)!.toISOString()
        : '';
      if (at && at > cur.lastDecisionAt) cur.lastDecisionAt = at;
      m.set(key, cur);
    }
    return {
      rows: Array.from(m.entries()).map(([key, payload]) => ({ key, payload })),
    };
  }
}
