import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Employee,
  EmployeeStatus,
} from './entities/employee.entity';
import {
  assertEmployeeTransition,
  canEmployeeTransition,
} from './state-machines/employee.fsm';
import {
  CreateEmployeeDto,
  EmployeeActivateDto,
  EmployeeOnboardDto,
  EmployeeTerminateDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './hr.dto';

/**
 * EmployeeService — anagrafica + onboarding FSM
 * (plan §31.1 Sprint 17 / S17.1).
 */
@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async create(
    tenantId: string,
    dto: CreateEmployeeDto,
  ): Promise<Employee> {
    const employeeNumber = await this.nextEmployeeNumber(tenantId);

    if (dto.fiscalCode) {
      const existing = await this.employeeRepo.findOne({
        where: { tenantId, fiscalCode: dto.fiscalCode },
      });
      if (existing) {
        throw new ConflictException(
          `Employee with fiscalCode '${dto.fiscalCode}' already exists in tenant`,
        );
      }
    }

    const e = this.employeeRepo.create({
      tenantId,
      employeeNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      fiscalCode: dto.fiscalCode ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      placeOfBirth: dto.placeOfBirth ?? null,
      nationality: dto.nationality ?? null,
      residenceAddress: dto.residenceAddress ?? {},
      contractType: dto.contractType ?? 'indeterminato',
      ccnlCode: dto.ccnlCode ?? null,
      payGradeCode: dto.payGradeCode ?? null,
      weeklyHours: dto.weeklyHours ?? '40',
      monthlyWageCents: dto.monthlyWageCents ?? 0,
      hourlyWageCents: dto.hourlyWageCents ?? 0,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
      managerEmployeeId: dto.managerEmployeeId ?? null,
      userId: dto.userId ?? null,
      notes: dto.notes ?? null,
      status: 'prospect',
    });
    return this.employeeRepo.save(e);
  }

  async list(
    tenantId: string,
    query: ListEmployeesQueryDto,
  ): Promise<Employee[]> {
    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.contractType)
      qb.andWhere('e.contractType = :contractType', {
        contractType: query.contractType,
      });
    if (query.ccnlCode)
      qb.andWhere('e.ccnlCode = :ccnlCode', { ccnlCode: query.ccnlCode });
    return qb
      .orderBy('e.lastName', 'ASC')
      .addOrderBy('e.firstName', 'ASC')
      .getMany();
  }

  async get(tenantId: string, id: string): Promise<Employee> {
    const e = await this.employeeRepo.findOne({ where: { tenantId, id } });
    if (!e) throw new NotFoundException(`Employee ${id} not found`);
    return e;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    const e = await this.get(tenantId, id);
    if (dto.fiscalCode && dto.fiscalCode !== e.fiscalCode) {
      const dup = await this.employeeRepo.findOne({
        where: { tenantId, fiscalCode: dto.fiscalCode },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Employee with fiscalCode '${dto.fiscalCode}' already exists in tenant`,
        );
      }
    }
    Object.assign(e, {
      ...dto,
      // numeric/json fields kept as-is when omitted
    });
    return this.employeeRepo.save(e);
  }

  async startOnboarding(
    tenantId: string,
    id: string,
    dto: EmployeeOnboardDto,
  ): Promise<Employee> {
    return this.transitionStatus(tenantId, id, 'onboarding', (e) => {
      if (dto.hireDate) e.hireDate = new Date(dto.hireDate);
    });
  }

  async activate(
    tenantId: string,
    id: string,
    dto: EmployeeActivateDto,
  ): Promise<Employee> {
    return this.transitionStatus(tenantId, id, 'active', (e) => {
      if (dto.hireDate) e.hireDate = new Date(dto.hireDate);
      if (!e.hireDate) {
        // Default to today when the caller didn't specify.
        e.hireDate = new Date();
      }
    });
  }

  async terminate(
    tenantId: string,
    id: string,
    dto: EmployeeTerminateDto,
  ): Promise<Employee> {
    return this.transitionStatus(tenantId, id, 'terminated', (e) => {
      e.terminationDate = new Date(dto.terminationDate);
      e.terminationReason = dto.terminationReason;
    });
  }

  // ─── Helpers ────────────────────────────────────────────────

  private async transitionStatus(
    tenantId: string,
    id: string,
    next: EmployeeStatus,
    apply: (e: Employee) => void,
  ): Promise<Employee> {
    const e = await this.get(tenantId, id);
    if (!canEmployeeTransition(e.status, next)) {
      throw new UnprocessableEntityException(
        `Invalid Employee transition: ${e.status} → ${next}`,
      );
    }
    assertEmployeeTransition(e.status, next);
    apply(e);
    e.status = next;
    return this.employeeRepo.save(e);
  }

  private async nextEmployeeNumber(tenantId: string): Promise<string> {
    const last = await this.employeeRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.createdAt', 'DESC')
      .limit(1)
      .getOne();
    if (!last) return 'EMP-0001';
    const m = /EMP-(\d+)/.exec(last.employeeNumber);
    if (!m) {
      throw new BadRequestException(
        'Cannot derive next employee number — non-standard format in tenant',
      );
    }
    const next = String(parseInt(m[1], 10) + 1).padStart(4, '0');
    return `EMP-${next}`;
  }
}
