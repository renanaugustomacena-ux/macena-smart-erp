import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { Attendance } from '../../hr/entities/attendance.entity';

/**
 * employee_attendance_summary — workedHours per employee per month.
 * Key = `<employeeId>:<YYYY-MM>`. Payload = { days, workedHours }.
 */
@Injectable()
export class EmployeeAttendanceSummaryProjection implements Projection {
  readonly id = 'employee_attendance_summary';
  readonly description =
    'Worked hours + days per employee per month (HR-lite reporting).';
  readonly source = 'attendances' as const;

  constructor(
    @InjectRepository(Attendance)
    private readonly attRepo: Repository<Attendance>,
  ) {}

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const qb = this.attRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId: ctx.tenantId });
    if (ctx.fromTimestamp)
      qb.andWhere('a.date >= :from', { from: ctx.fromTimestamp });
    if (ctx.toTimestamp) qb.andWhere('a.date < :to', { to: ctx.toTimestamp });
    const rows = await qb.getMany();
    const m = new Map<string, { days: number; workedHours: number }>();
    for (const r of rows) {
      const d = new Date(r.date);
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const key = `${r.employeeId}:${ym}`;
      const cur = m.get(key) ?? { days: 0, workedHours: 0 };
      cur.days += 1;
      cur.workedHours += Number(r.workedHours ?? 0);
      m.set(key, cur);
    }
    return {
      rows: Array.from(m.entries()).map(([key, payload]) => ({
        key,
        payload: {
          days: payload.days,
          workedHours: Math.round(payload.workedHours * 100) / 100,
        },
      })),
    };
  }
}
