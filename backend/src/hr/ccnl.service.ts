import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Ccnl,
  CcnlLeaveEntitlement,
  CcnlPayGrade,
} from './entities/ccnl.entity';

/**
 * CcnlService — read-only access to the global CCNL reference data
 * (plan §31.1 Sprint 17 / S17.4).
 *
 * The data is global (not tenant-scoped). The `no-untenanted-query`
 * lint rule is suppressed per call with a justifying comment per the
 * doctrine R-D02 escape policy: a CCNL applies to every Italian employer
 * in the sector and a tenantId predicate would be incorrect, not just
 * unnecessary.
 */
@Injectable()
export class CcnlService {
  constructor(
    @InjectRepository(Ccnl)
    private readonly ccnlRepo: Repository<Ccnl>,
    @InjectRepository(CcnlPayGrade)
    private readonly payGradeRepo: Repository<CcnlPayGrade>,
    @InjectRepository(CcnlLeaveEntitlement)
    private readonly leaveEntitlementRepo: Repository<CcnlLeaveEntitlement>,
  ) {}

  async listCcnls(): Promise<Ccnl[]> {
    // Global reference data — no tenant scope.
    // eslint-disable-next-line no-untenanted-query
    return this.ccnlRepo.find({ order: { code: 'ASC' } });
  }

  async getCcnl(code: string): Promise<Ccnl> {
    // Global reference data — no tenant scope.
    // eslint-disable-next-line no-untenanted-query
    const c = await this.ccnlRepo.findOne({ where: { code } });
    if (!c) throw new NotFoundException(`CCNL '${code}' not found`);
    return c;
  }

  async listPayGrades(ccnlCode: string): Promise<CcnlPayGrade[]> {
    // Global reference data — no tenant scope.
    // eslint-disable-next-line no-untenanted-query
    return this.payGradeRepo.find({
      where: { ccnlCode },
      order: { code: 'ASC' },
    });
  }

  async listLeaveEntitlements(
    ccnlCode: string,
  ): Promise<CcnlLeaveEntitlement[]> {
    // Global reference data — no tenant scope.
    // eslint-disable-next-line no-untenanted-query
    return this.leaveEntitlementRepo.find({
      where: { ccnlCode },
      order: { leaveType: 'ASC' },
    });
  }
}
