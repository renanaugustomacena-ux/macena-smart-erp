import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service';
import { LeaveRequest } from './entities/leave-request.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';
const EMP = '22222222-2222-2222-2222-222222222222';
const MGR = '33333333-3333-3333-3333-333333333333';

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
  const data: LeaveRequest[] = [];
  const repo = {
    findOne: async ({ where }: { where: Partial<LeaveRequest> }) =>
      data.find((r) =>
        Object.entries(where ?? {}).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    save: async (r: LeaveRequest) => {
      const i = data.findIndex((x) => x.id === r.id);
      if (i >= 0) data[i] = r;
      else data.push(r);
      return r;
    },
    create: (partial: Partial<LeaveRequest>) =>
      ({
        id: `lr-${data.length + 1}`,
        tags: [],
        ...partial,
      }) as LeaveRequest,
    createQueryBuilder: () => qb(data),
  };

  const module = await Test.createTestingModule({
    providers: [
      LeaveRequestService,
      { provide: getRepositoryToken(LeaveRequest), useValue: repo },
    ],
  }).compile();
  return { svc: module.get(LeaveRequestService) };
}

describe('LeaveRequestService — approval flow (S17.3)', () => {
  const baseDto = {
    employeeId: EMP,
    leaveType: 'ferie' as const,
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    daysRequested: '11',
  };

  it('creates a DRAFT then walks to SUBMITTED → APPROVED', async () => {
    const { svc } = await build();
    const created = await svc.create(TENANT, baseDto);
    expect(created.status).toBe('draft');

    const submitted = await svc.submit(TENANT, created.id);
    expect(submitted.status).toBe('submitted');

    const approved = await svc.approve(TENANT, created.id, MGR, {});
    expect(approved.status).toBe('approved');
    expect(approved.decidedBy).toBe(MGR);
  });

  it('manager rejects with reason', async () => {
    const { svc } = await build();
    const created = await svc.create(TENANT, baseDto);
    await svc.submit(TENANT, created.id);
    const rejected = await svc.reject(TENANT, created.id, MGR, {
      reason: 'Pianificazione produzione',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.decisionReason).toBe('Pianificazione produzione');
  });

  it('refuses to approve a draft (must submit first)', async () => {
    const { svc } = await build();
    const created = await svc.create(TENANT, baseDto);
    await expect(
      svc.approve(TENANT, created.id, MGR, {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('manager can cancel an approved leave (early return)', async () => {
    const { svc } = await build();
    const created = await svc.create(TENANT, baseDto);
    await svc.submit(TENANT, created.id);
    await svc.approve(TENANT, created.id, MGR, {});
    const cancelled = await svc.cancel(TENANT, created.id, MGR, {
      reason: 'Rientro anticipato',
    });
    expect(cancelled.status).toBe('cancelled');
  });
});
