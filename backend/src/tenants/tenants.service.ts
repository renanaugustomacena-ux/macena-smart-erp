import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, SubscriptionPlan, TenantStatus } from './tenant.entity';

export interface CreateTenantInput {
  name: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdiDestinationCode?: string;
  pecEmail?: string;
  billingAddress?: string;
  billingCity?: string;
  billingPostalCode?: string;
  billingProvince?: string;
  plan?: SubscriptionPlan;
  settings?: Record<string, unknown>;
}

export interface UpdateTenantInput extends Partial<CreateTenantInput> {
  status?: TenantStatus;
  seatLimit?: number;
}

const DEFAULT_SEAT_LIMIT: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.BASE]: 3,
  [SubscriptionPlan.PROFESSIONALE]: 15,
  [SubscriptionPlan.ENTERPRISE]: -1,
};

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantInput): Promise<Tenant> {
    if (dto.vatNumber) {
      // Tenant aggregate dedup by Partita IVA — operating on the tenant
      // registry itself; no parent-tenant scope exists.
      // eslint-disable-next-line no-untenanted-query
      const existing = await this.tenantRepository.findOne({
        where: { vatNumber: dto.vatNumber },
      });
      if (existing) {
        throw new ConflictException(
          `A tenant with Partita IVA ${dto.vatNumber} is already registered`,
        );
      }
    }
    const plan = dto.plan ?? SubscriptionPlan.BASE;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);
    const tenant = this.tenantRepository.create({
      ...dto,
      plan,
      status: TenantStatus.TRIAL,
      seatLimit: DEFAULT_SEAT_LIMIT[plan],
      trialEndsAt,
      settings: dto.settings ?? {
        locale: 'it',
        timezone: 'Europe/Rome',
        currency: 'EUR',
        iva_default: 22,
        accounting_template: 'pc_iv_direttiva_cee',
      },
    });
    const saved = await this.tenantRepository.save(tenant);
    this.logger.log(`Tenant created: ${saved.id} (${saved.name}), plan=${plan}`);
    return saved;
  }

  async findById(id: string): Promise<Tenant> {
    // Tenant entity lookup by its own PK; tenantId IS this entity's id.
    // eslint-disable-next-line no-untenanted-query
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return tenant;
  }

  /**
   * Lookup a tenant but enforce scope: the caller's JWT tenantId must match
   * the requested id. Returns 404 (not 403) on cross-tenant reads — this
   * hides whether the foreign tenant id exists at all.
   */
  async findByIdForCaller(id: string, callerTenantId: string): Promise<Tenant> {
    if (id !== callerTenantId) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return this.findById(id);
  }

  async update(id: string, dto: UpdateTenantInput): Promise<Tenant> {
    const tenant = await this.findById(id);
    Object.assign(tenant, dto);
    if (dto.plan && !dto.seatLimit) {
      tenant.seatLimit = DEFAULT_SEAT_LIMIT[dto.plan];
    }
    return this.tenantRepository.save(tenant);
  }

  async updateForCaller(
    id: string,
    callerTenantId: string,
    dto: UpdateTenantInput,
  ): Promise<Tenant> {
    if (id !== callerTenantId) {
      throw new ForbiddenException('Cannot update another tenant');
    }
    return this.update(id, dto);
  }

  async suspend(id: string): Promise<Tenant> {
    return this.update(id, { status: TenantStatus.SUSPENDED });
  }

  async activate(id: string): Promise<Tenant> {
    return this.update(id, { status: TenantStatus.ACTIVE });
  }
}
