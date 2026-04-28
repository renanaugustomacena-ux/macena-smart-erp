import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import {
  assertAttendanceTransition,
  canAttendanceTransition,
} from './state-machines/attendance.fsm';
import {
  ClockInDto,
  ClockOutDto,
  ListAttendancesQueryDto,
} from './hr.dto';

/**
 * AttendanceService — clock-in / clock-out
 * (plan §31.1 Sprint 17 / S17.2).
 *
 * Idempotent within a single calendar day per (tenantId, employeeId, date).
 */
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  async clockIn(
    tenantId: string,
    actorUserId: string | null,
    dto: ClockInDto,
  ): Promise<Attendance> {
    const date = parseDate(dto.date);
    const at = dto.at ? new Date(dto.at) : new Date();

    let row = await this.attendanceRepo.findOne({
      where: { tenantId, employeeId: dto.employeeId, date },
    });
    if (row) {
      // Re-clock-in is idempotent: refresh the in-time if the row is open;
      // refuse if the row is already closed (manual fix-up needed).
      if (row.status !== 'open') {
        throw new BadRequestException(
          `Attendance for ${dto.employeeId} on ${formatDate(date)} is already ${row.status}`,
        );
      }
      row.clockInAt = at;
      if (dto.location) row.location = dto.location;
      if (dto.locationLabel !== undefined) row.locationLabel = dto.locationLabel;
      return this.attendanceRepo.save(row);
    }

    row = this.attendanceRepo.create({
      tenantId,
      employeeId: dto.employeeId,
      date,
      clockInAt: at,
      breakMinutes: 0,
      workedHours: '0',
      location: dto.location ?? 'office',
      locationLabel: dto.locationLabel ?? null,
      status: 'open',
      recordedBy: actorUserId,
    });
    return this.attendanceRepo.save(row);
  }

  async clockOut(
    tenantId: string,
    dto: ClockOutDto,
  ): Promise<Attendance> {
    const date = parseDate(dto.date);
    const at = dto.at ? new Date(dto.at) : new Date();

    const row = await this.attendanceRepo.findOne({
      where: { tenantId, employeeId: dto.employeeId, date },
    });
    if (!row) {
      throw new NotFoundException(
        `No attendance row found for employee ${dto.employeeId} on ${formatDate(date)}`,
      );
    }
    if (row.status !== 'open') {
      throw new BadRequestException(
        `Attendance is already ${row.status} — cannot clock out again`,
      );
    }
    if (!row.clockInAt) {
      throw new BadRequestException(
        'Cannot clock out: no clock-in time recorded',
      );
    }
    if (at.getTime() < row.clockInAt.getTime()) {
      throw new BadRequestException(
        'clockOut time must be after clockIn time',
      );
    }
    row.clockOutAt = at;
    row.breakMinutes = dto.breakMinutes ?? row.breakMinutes;
    if (dto.notes !== undefined) row.notes = dto.notes;

    const grossMinutes =
      (at.getTime() - row.clockInAt.getTime()) / (60 * 1000);
    const netMinutes = Math.max(0, grossMinutes - row.breakMinutes);
    row.workedHours = (Math.round((netMinutes / 60) * 100) / 100).toFixed(2);
    assertAttendanceTransition(row.status, 'closed');
    row.status = 'closed';
    return this.attendanceRepo.save(row);
  }

  async list(
    tenantId: string,
    query: ListAttendancesQueryDto,
  ): Promise<Attendance[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId });
    if (query.employeeId)
      qb.andWhere('a.employeeId = :employeeId', { employeeId: query.employeeId });
    if (query.fromDate)
      qb.andWhere('a.date >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)
      qb.andWhere('a.date <= :toDate', { toDate: query.toDate });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    return qb
      .orderBy('a.date', 'DESC')
      .addOrderBy('a.employeeId', 'ASC')
      .getMany();
  }

  /**
   * Sweep open attendance rows older than yesterday and auto-close them.
   * Intended for a daily 23:59 Europe/Rome cron; in v1 the production
   * scheduler is wired in Sprint 19 along with the warehouse PWA work.
   */
  async sweepOrphans(
    tenantId: string,
    cutoffDate: Date,
  ): Promise<{ closed: number }> {
    const orphans = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.status = :status', { status: 'open' })
      .andWhere('a.date < :cutoff', { cutoff: cutoffDate })
      .getMany();

    for (const row of orphans) {
      if (canAttendanceTransition(row.status, 'auto_closed')) {
        row.status = 'auto_closed';
        if (row.clockInAt && !row.clockOutAt) {
          // Cap at end-of-day for the row's date.
          const eod = new Date(row.date);
          eod.setUTCHours(23, 59, 0, 0);
          row.clockOutAt = eod;
          const grossMinutes =
            (eod.getTime() - row.clockInAt.getTime()) / (60 * 1000);
          const netMinutes = Math.max(0, grossMinutes - row.breakMinutes);
          row.workedHours = (Math.round((netMinutes / 60) * 100) / 100).toFixed(
            2,
          );
        }
        await this.attendanceRepo.save(row);
      }
    }
    return { closed: orphans.length };
  }
}

function parseDate(s: string | undefined): Date {
  if (!s) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  // Accept either YYYY-MM-DD or full ISO; normalise to UTC midnight.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date '${s}'`);
  }
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
