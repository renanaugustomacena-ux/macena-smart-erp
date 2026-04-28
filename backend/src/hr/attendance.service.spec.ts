import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance } from './entities/attendance.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';
const EMP = '22222222-2222-2222-2222-222222222222';
const USER = '33333333-3333-3333-3333-333333333333';

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  getMany: () => Promise<T[]>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    getMany: async () => rows,
  };
  return stub;
}

async function build() {
  const data: Attendance[] = [];
  const repo = {
    findOne: async ({ where }: { where: Partial<Attendance> }) =>
      data.find((r) => {
        const w = where as Partial<Attendance>;
        if (w.tenantId !== undefined && r.tenantId !== w.tenantId) return false;
        if (w.employeeId !== undefined && r.employeeId !== w.employeeId)
          return false;
        if (w.date !== undefined) {
          const a = (r.date as unknown as Date).getTime?.() ?? r.date;
          const b = (w.date as unknown as Date).getTime?.() ?? w.date;
          if (a !== b) return false;
        }
        return true;
      }) ?? null,
    save: async (r: Attendance) => {
      const i = data.findIndex((x) => x.id === r.id);
      if (i >= 0) data[i] = r;
      else data.push(r);
      return r;
    },
    create: (partial: Partial<Attendance>) =>
      ({
        id: `att-${data.length + 1}`,
        ...partial,
      }) as Attendance,
    createQueryBuilder: () => qb(data),
  };

  const module = await Test.createTestingModule({
    providers: [
      AttendanceService,
      { provide: getRepositoryToken(Attendance), useValue: repo },
    ],
  }).compile();
  return { svc: module.get(AttendanceService), data };
}

describe('AttendanceService — clock-in / clock-out (S17.2)', () => {
  it('creates an open row on first clock-in and computes worked hours on clock-out', async () => {
    const { svc } = await build();
    const inAt = '2026-05-04T08:00:00.000Z';
    const outAt = '2026-05-04T17:30:00.000Z';

    const opened = await svc.clockIn(TENANT, USER, {
      employeeId: EMP,
      date: '2026-05-04',
      at: inAt,
      location: 'office',
    });
    expect(opened.status).toBe('open');
    expect(opened.clockInAt?.toISOString()).toBe(inAt);

    const closed = await svc.clockOut(TENANT, {
      employeeId: EMP,
      date: '2026-05-04',
      at: outAt,
      breakMinutes: 30,
    });
    expect(closed.status).toBe('closed');
    expect(closed.clockOutAt?.toISOString()).toBe(outAt);
    // 9.5h gross - 0.5h break = 9.00h worked
    expect(closed.workedHours).toBe('9.00');
  });

  it('refuses clock-out without a matching row', async () => {
    const { svc } = await build();
    await expect(
      svc.clockOut(TENANT, { employeeId: EMP, date: '2026-05-04' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses clock-out with at < clockInAt', async () => {
    const { svc } = await build();
    await svc.clockIn(TENANT, USER, {
      employeeId: EMP,
      date: '2026-05-04',
      at: '2026-05-04T10:00:00Z',
    });
    await expect(
      svc.clockOut(TENANT, {
        employeeId: EMP,
        date: '2026-05-04',
        at: '2026-05-04T09:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses double clock-out', async () => {
    const { svc } = await build();
    await svc.clockIn(TENANT, USER, {
      employeeId: EMP,
      date: '2026-05-04',
      at: '2026-05-04T08:00:00Z',
    });
    await svc.clockOut(TENANT, {
      employeeId: EMP,
      date: '2026-05-04',
      at: '2026-05-04T17:00:00Z',
    });
    await expect(
      svc.clockOut(TENANT, {
        employeeId: EMP,
        date: '2026-05-04',
        at: '2026-05-04T17:30:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
