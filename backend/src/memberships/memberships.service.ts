import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Membership,
  MembershipRole,
  MembershipStatus,
} from './membership.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AuthService, User, UserRole } from '../auth/auth.service';
// `UserRole` is re-exported below so callers wiring this service via
// the controller layer can keep their existing imports.
export { UserRole };

/**
 * MembershipsService — operates the multi-tenant join behind the
 * "Andrea pattern" (plan §31.1 Sprint 16 / S16.3).
 *
 * Responsibilities:
 *   - list memberships for the calling user
 *   - invite, consent, revoke memberships
 *   - mint fresh JWTs when the user switches active tenant
 *
 * Authorisation conventions (v1):
 *   - Only an `admin` of the granting tenant may invite memberships into
 *     that tenant. The MembershipsController enforces this via the
 *     existing `RolesGuard`.
 *   - A user may only consent or revoke a membership where they are the
 *     subject (`userId === currentUser.id`).
 */
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  // ─── Read ─────────────────────────────────────────────────────

  async listMine(userId: string): Promise<
    Array<{
      membership: Membership;
      tenant: Pick<Tenant, 'id' | 'name' | 'plan' | 'status'>;
    }>
  > {
    // Lookup by userId (a global UUID); tenant scope is the natural
    // axis of the response, not a filter.
    // eslint-disable-next-line no-untenanted-query
    const memberships = await this.membershipRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    if (memberships.length === 0) return [];

    const tenantIds = Array.from(new Set(memberships.map((m) => m.tenantId)));
    // Tenant rows by id (one per tenant); tenants table is itself the
    // tenant-scope axis.
    // eslint-disable-next-line no-untenanted-query
    const tenants = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...ids)', { ids: tenantIds })
      .getMany();
    const tenantsById = new Map(tenants.map((t) => [t.id, t]));

    return memberships.map((m) => {
      const t = tenantsById.get(m.tenantId);
      return {
        membership: m,
        tenant: {
          id: t?.id ?? m.tenantId,
          name: t?.name ?? '(unknown tenant)',
          plan: t?.plan ?? ('base' as Tenant['plan']),
          status: t?.status ?? ('active' as Tenant['status']),
        },
      };
    });
  }

  async listForTenant(
    tenantId: string,
    filters: { role?: MembershipRole; status?: MembershipStatus } = {},
  ): Promise<Membership[]> {
    const qb = this.membershipRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId });
    if (filters.role) qb.andWhere('m.role = :role', { role: filters.role });
    if (filters.status)
      qb.andWhere('m.status = :status', { status: filters.status });
    return qb.orderBy('m.createdAt', 'ASC').getMany();
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  async invite(
    tenantId: string,
    invitedBy: string,
    targetUserId: string,
    role: MembershipRole,
  ): Promise<Membership> {
    // Idempotency: if a membership row already exists, return / refresh it
    // rather than creating a duplicate.
    const existing = await this.membershipRepo.findOne({
      where: { tenantId, userId: targetUserId },
    });
    if (existing) {
      if (existing.status === 'active' && existing.role === role) {
        return existing;
      }
      if (existing.status === 'revoked') {
        existing.status = 'pending';
        existing.role = role;
        existing.invitedAt = new Date();
        existing.invitedBy = invitedBy;
        existing.revokedAt = null;
        existing.revokedBy = null;
        return this.membershipRepo.save(existing);
      }
      throw new ConflictException(
        `Membership already exists in status '${existing.status}'`,
      );
    }

    const m = this.membershipRepo.create({
      tenantId,
      userId: targetUserId,
      role,
      status: 'pending',
      invitedAt: new Date(),
      invitedBy,
    });
    return this.membershipRepo.save(m);
  }

  async consent(membershipId: string, userId: string): Promise<Membership> {
    // Subject-side consent: lookup is by membershipId (UUID). We re-check
    // the userId match in-process to enforce the "only the subject can
    // consent" invariant.
    // eslint-disable-next-line no-untenanted-query
    const m = await this.membershipRepo.findOne({ where: { id: membershipId } });
    if (!m) throw new NotFoundException('Membership not found');
    if (m.userId !== userId) {
      throw new ForbiddenException(
        'Only the subject of the membership may consent',
      );
    }
    if (m.status !== 'pending') {
      throw new BadRequestException(
        `Cannot consent membership in status '${m.status}'`,
      );
    }
    m.status = 'active';
    m.consentedAt = new Date();
    m.grantedAt = new Date();
    return this.membershipRepo.save(m);
  }

  async revoke(
    membershipId: string,
    actorUserId: string,
    actorRole: UserRole | MembershipRole,
    actorTenantId: string,
  ): Promise<Membership> {
    // eslint-disable-next-line no-untenanted-query
    const m = await this.membershipRepo.findOne({ where: { id: membershipId } });
    if (!m) throw new NotFoundException('Membership not found');

    // Authorisation: subject may always revoke their own membership;
    // the tenant admin may revoke memberships into their tenant.
    const isSubject = m.userId === actorUserId;
    // Both UserRole.ADMIN (enum) and the 'admin' MembershipRole literal
    // resolve to the same string value, so a single string compare is
    // exhaustive across both unions.
    const isTenantAdmin =
      m.tenantId === actorTenantId && String(actorRole) === 'admin';
    if (!isSubject && !isTenantAdmin) {
      throw new ForbiddenException(
        'Only the membership subject or the tenant admin may revoke',
      );
    }
    if (m.status === 'revoked') return m;

    m.status = 'revoked';
    m.revokedAt = new Date();
    m.revokedBy = actorUserId;
    return this.membershipRepo.save(m);
  }

  // ─── Tenant switch (the Andrea Portal entry-point) ────────────

  async switchTenant(
    userId: string,
    targetTenantId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    membership: Membership;
  }> {
    const m = await this.membershipRepo.findOne({
      where: { tenantId: targetTenantId, userId },
    });
    if (!m) {
      throw new NotFoundException(
        `No membership for user in tenant ${targetTenantId}`,
      );
    }
    if (m.status !== 'active') {
      throw new ForbiddenException(
        `Membership is not active (status='${m.status}')`,
      );
    }
    const tokens = await this.authService.mintTokensForTenantSwitch(
      userId,
      targetTenantId,
      this.toUserRole(m.role),
    );
    this.logger.log({
      event: 'memberships.switch',
      userId,
      tenantId: targetTenantId,
      role: m.role,
    });
    return { ...tokens, membership: m };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private toUserRole(role: MembershipRole): UserRole {
    // The `commercialista` role is rendered as VIEWER in the JWT for
    // existing RBAC guards (read-mostly, no write privileges by default).
    // Fine-grained scopes will refine this in v2.
    switch (role) {
      case 'admin':
        return UserRole.ADMIN;
      case 'manager':
        return UserRole.MANAGER;
      case 'operator':
        return UserRole.OPERATOR;
      case 'commercialista':
      case 'viewer':
      default:
        return UserRole.VIEWER;
    }
  }
}
