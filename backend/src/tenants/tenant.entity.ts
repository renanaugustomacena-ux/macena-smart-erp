import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * SubscriptionPlan enum maps to SmartERP commercial tiers.
 * Base €99/user/month, Professionale €199/user/month, Enterprise custom.
 */
export enum SubscriptionPlan {
  BASE = 'base',
  PROFESSIONALE = 'professionale',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

/**
 * Tenant = one SmartERP customer organisation.
 *
 * Every data-bearing entity in the system carries a `tenantId` foreign key to
 * this table. Multi-tenancy enforcement is performed in service methods and
 * cross-checked by TenantGuard at controller boundaries.
 */
@Entity('tenants')
@Index(['vatNumber'], { unique: true, where: '"vatNumber" IS NOT NULL' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  /**
   * Italian Partita IVA, 11 numeric digits. Nullable for tenants in
   * pre-registration (foreign companies, regime forfettario with no IVA).
   */
  @Column({ length: 11, nullable: true })
  vatNumber: string;

  /**
   * Italian Codice Fiscale, 11 numeric (PI) or 16 alphanumeric (CF persona fisica).
   */
  @Column({ length: 16, nullable: true })
  fiscalCode: string;

  /**
   * SDI destination code (Codice Destinatario), 7 alphanumeric.
   * Default '0000000' when only PEC is used for e-invoice delivery.
   */
  @Column({ length: 7, nullable: true })
  sdiDestinationCode: string;

  /**
   * PEC (Posta Elettronica Certificata) mailbox for legal/fiscal communications.
   */
  @Column({ length: 255, nullable: true })
  pecEmail: string;

  @Column({ type: 'text', nullable: true })
  billingAddress: string;

  @Column({ length: 100, nullable: true })
  billingCity: string;

  @Column({ length: 5, nullable: true })
  billingPostalCode: string;

  @Column({ length: 2, nullable: true })
  billingProvince: string;

  @Column({ length: 2, default: 'IT' })
  billingCountry: string;

  @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.BASE })
  plan: SubscriptionPlan;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ type: 'int', default: 3 })
  seatLimit: number;

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  /**
   * Tenant-scoped feature flags and preferences.
   * Example: { "locale": "it", "timezone": "Europe/Rome", "currency": "EUR",
   *           "iva_default": 22, "accounting_template": "pc_iv_direttiva_cee" }
   */
  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
