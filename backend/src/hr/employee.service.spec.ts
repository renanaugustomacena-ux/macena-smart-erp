import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';

interface QbStub<T> {
  where: () => QbStub<T>;
  andWhere: () => QbStub<T>;
  orderBy: () => QbStub<T>;
  addOrderBy: () => QbStub<T>;
  limit: () => QbStub<T>;
  getMany: () => Promise<T[]>;
  getOne: () => Promise<T | null>;
}

function qb<T>(rows: T[]): QbStub<T> {
  const stub: QbStub<T> = {
    where: () => stub,
    andWhere: () => stub,
    orderBy: () => stub,
    addOrderBy: () => stub,
    limit: () => stub,
    getMany: async () => rows,
    getOne: async () => rows[0] ?? null,
  };
  return stub;
}

async function build(initial: Employee[] = []) {
  const data = [...initial];
  const repo = {
    findOne: async ({ where }: { where: Partial<Employee> }) =>
      data.find((e) =>
        Object.entries(where ?? {}).every(
          ([k, v]) => (e as unknown as Record<string, unknown>)[k] === v,
        ),
      ) ?? null,
    save: async (e: Employee) => {
      const i = data.findIndex((x) => x.id === e.id);
      if (i >= 0) data[i] = e;
      else data.push(e);
      return e;
    },
    create: (partial: Partial<Employee>) =>
      ({
        id: `emp-${data.length + 1}`,
        residenceAddress: {},
        weeklyHours: '40',
        monthlyWageCents: 0,
        hourlyWageCents: 0,
        ...partial,
      }) as Employee,
    createQueryBuilder: () => qb(data),
  };
  const module = await Test.createTestingModule({
    providers: [
      EmployeeService,
      { provide: getRepositoryToken(Employee), useValue: repo },
    ],
  }).compile();
  return { svc: module.get(EmployeeService), data };
}

describe('EmployeeService — onboarding lifecycle (S17.1)', () => {
  it('creates a PROSPECT and assigns the next employee number', async () => {
    const { svc } = await build();
    const e = await svc.create(TENANT, {
      firstName: 'Marco',
      lastName: 'Rossi',
      contractType: 'indeterminato',
      ccnlCode: 'metalmeccanico_industria',
      payGradeCode: 'liv_4',
    });
    expect(e.status).toBe('prospect');
    expect(e.employeeNumber).toBe('EMP-0001');

    const e2 = await svc.create(TENANT, {
      firstName: 'Sara',
      lastName: 'Bianchi',
    });
    expect(e2.employeeNumber).toBe('EMP-0002');
  });

  it('refuses duplicate fiscalCode within tenant', async () => {
    const { svc } = await build();
    await svc.create(TENANT, {
      firstName: 'Marco',
      lastName: 'Rossi',
      fiscalCode: 'RSSMRC80A01H501Z',
    });
    await expect(
      svc.create(TENANT, {
        firstName: 'Mario',
        lastName: 'Verdi',
        fiscalCode: 'RSSMRC80A01H501Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('walks the full prospect → onboarding → active → terminated flow', async () => {
    const { svc } = await build();
    const created = await svc.create(TENANT, {
      firstName: 'Marco',
      lastName: 'Rossi',
    });

    const onboard = await svc.startOnboarding(TENANT, created.id, {});
    expect(onboard.status).toBe('onboarding');

    const active = await svc.activate(TENANT, created.id, {
      hireDate: '2026-05-01',
    });
    expect(active.status).toBe('active');
    expect(active.hireDate).toBeInstanceOf(Date);

    const term = await svc.terminate(TENANT, created.id, {
      terminationDate: '2027-04-30',
      terminationReason: 'Pensionamento',
    });
    expect(term.status).toBe('terminated');
    expect(term.terminationReason).toBe('Pensionamento');
  });

  it('refuses to skip onboarding straight to active', async () => {
    const { svc } = await build();
    const e = await svc.create(TENANT, {
      firstName: 'Marco',
      lastName: 'Rossi',
    });
    await expect(svc.activate(TENANT, e.id, {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
