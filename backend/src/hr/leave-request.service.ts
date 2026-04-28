import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LeaveRequest,
  LeaveStatus,
} from './entities/leave-request.entity';
import {
  assertLeaveTransition,
  canLeaveTransition,
} from './state-machines/leave-request.fsm';
import {
  CreateLeaveRequestDto,
  DecideLeaveRequestDto,
  ListLeaveRequestsQueryDto,
} from './hr.dto';

/**
 * LeaveRequestService — domanda di ferie / permesso / malattia
 * (plan §31.1 Sprint 17 / S17.3).
 */
@Injectable()
export class LeaveRequestService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
  ) {}

  async create(
    tenantId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate/endDate');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const r = this.leaveRepo.create({
      tenantId,
      employeeId: dto.employeeId,
      leaveType: dto.leaveType,
      startDate: start,
      endDate: end,
      daysRequested: dto.daysRequested,
      reason: dto.reason ?? null,
      tags: dto.tags ?? [],
      status: 'draft',
    });
    return this.leaveRepo.save(r);
  }

  async list(
    tenantId: string,
    query: ListLeaveRequestsQueryDto,
  ): Promise<LeaveRequest[]> {
    const qb = this.leaveRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });
    if (query.employeeId)
      qb.andWhere('r.employeeId = :employeeId', { employeeId: query.employeeId });
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.leaveType)
      qb.andWhere('r.leaveType = :leaveType', { leaveType: query.leaveType });
    if (query.fromDate)
      qb.andWhere('r.startDate >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)
      qb.andWhere('r.endDate <= :toDate', { toDate: query.toDate });
    return qb.orderBy('r.startDate', 'DESC').getMany();
  }

  async get(tenantId: string, id: string): Promise<LeaveRequest> {
    const r = await this.leaveRepo.findOne({ where: { tenantId, id } });
    if (!r) throw new NotFoundException(`LeaveRequest ${id} not found`);
    return r;
  }

  async submit(tenantId: string, id: string): Promise<LeaveRequest> {
    return this.transition(tenantId, id, 'submitted', (r) => {
      r.submittedAt = new Date();
    });
  }

  async approve(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequest> {
    return this.transition(tenantId, id, 'approved', (r) => {
      r.decidedAt = new Date();
      r.decidedBy = actorUserId;
      r.decisionReason = dto.reason ?? null;
    });
  }

  async reject(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequest> {
    return this.transition(tenantId, id, 'rejected', (r) => {
      r.decidedAt = new Date();
      r.decidedBy = actorUserId;
      r.decisionReason = dto.reason ?? null;
    });
  }

  async cancel(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: DecideLeaveRequestDto,
  ): Promise<LeaveRequest> {
    return this.transition(tenantId, id, 'cancelled', (r) => {
      r.decidedAt = new Date();
      r.decidedBy = actorUserId;
      r.decisionReason = dto.reason ?? null;
    });
  }

  // ─── Helpers ────────────────────────────────────────────────

  private async transition(
    tenantId: string,
    id: string,
    next: LeaveStatus,
    apply: (r: LeaveRequest) => void,
  ): Promise<LeaveRequest> {
    const r = await this.get(tenantId, id);
    if (!canLeaveTransition(r.status, next)) {
      throw new UnprocessableEntityException(
        `Invalid LeaveRequest transition: ${r.status} → ${next}`,
      );
    }
    assertLeaveTransition(r.status, next);
    r.status = next;
    apply(r);
    return this.leaveRepo.save(r);
  }
}
